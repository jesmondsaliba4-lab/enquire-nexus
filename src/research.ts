// "Request further research": a visitor asks ThinkPeople Nexus to go further than an answer.
// One channel for every site: Enquire's own editions, and the ThinkPeople sites that pass their
// readers' requests on (cde.news, Corporate Times, ...). Kept in Enquire's database (EU) and shown,
// labelled by site, on the release desk.

import type { Env } from "./types";
import { clip } from "./text";

const EMAIL = /^[^\s@<>()]{1,64}@[^\s@<>()]{1,190}\.[a-z]{2,24}$/i;

/** Sites whose readers' requests may come in, by the label shown on the desk. */
export const REQUEST_SOURCES: Record<string, string> = {
  "https://cde.news": "cde.news",
  "https://www.corporate-times.com": "corporate-times.com",
  "https://corporate-times.com": "corporate-times.com",
  "https://thinkpeople.io": "thinkpeople.io",
  "https://thinkpeoplenexus.com": "thinkpeoplenexus.com",
  "https://www.leonardo2050.com": "leonardo2050.com",
  "https://leonardo2050.com": "leonardo2050.com",
  "https://shaipingmalta.eu": "shaipingmalta.eu",
  "https://thinkpeople.you": "thinkpeople.you",
  "https://www.maltaobserver.com": "maltaobserver.com",
};
const SOURCE_NAMES = new Set(Object.values(REQUEST_SOURCES));

/**
 * @param fromOrigin the site label when the request came from a listed site's page (decided by the caller
 *                   from the Origin header); null for Enquire's own pages or a server-to-server call.
 */
export async function saveResearchRequest(request: Request, env: Env, fromOrigin: string | null = null): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!env.ENQUIRE_DB) return { status: 503, body: { error: "Requests cannot be received just now." } };
  let j: Record<string, unknown>;
  try {
    if (Number(request.headers.get("content-length") || 0) > 8000) throw new Error("too big");
    j = (await request.json()) as Record<string, unknown>;
  } catch {
    return { status: 400, body: { error: "The request could not be read." } };
  }
  if (j.website) return { status: 200, body: { ok: true } }; // honeypot: quietly ignore
  const name = clip(j.name, 120);
  const email = clip(j.email, 254);
  const message = clip(j.message, 2000);
  if (name.length === 1) return { status: 400, body: { error: "Please give your name." } };
  if (!EMAIL.test(email)) return { status: 400, body: { error: "Please give an email address we can reply to." } };
  if (message.length < 10) return { status: 400, body: { error: "Please say a little more about what you need." } };
  if (j.consent !== true) return { status: 400, body: { error: "Please confirm we may reply to you about this request." } };

  // which site it came from: the page's own origin wins; a server (e.g. cde.news's WordPress) names itself
  const named = clip(j.source, 60).toLowerCase();
  const source = fromOrigin || (SOURCE_NAMES.has(named) ? named : "enquire.nexus");
  const link = clip(j.link, 500);
  const fullMessage = /^https:\/\//i.test(link) ? `${message}\n\nAnswer page: ${link}` : message;

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (env.ENQUIRE_LIMIT) {
    const { success } = await env.ENQUIRE_LIMIT.limit({ key: `research:${ip}` });
    if (!success) return { status: 429, body: { error: "Please wait a minute before sending another request." } };
  }
  await env.ENQUIRE_DB.prepare(
    `INSERT INTO research_requests (id, created_at, q, edition, message, name, email, organisation, status, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`)
    .bind(crypto.randomUUID(), new Date().toISOString(), clip(j.q, 300), clip(j.edition, 40), clip(fullMessage, 2600), name, email, clip(j.organisation, 160), source)
    .run();
  return { status: 200, body: { ok: true } };
}
