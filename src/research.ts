// "Request further research": a visitor asks ThinkPeople Nexus to go further than an answer.
// Kept in Enquire's own database (EU) and shown on the release desk. Nothing is sent anywhere else.

import type { Env } from "./types";
import { clip } from "./text";

const EMAIL = /^[^\s@<>()]{1,64}@[^\s@<>()]{1,190}\.[a-z]{2,24}$/i;

export async function saveResearchRequest(request: Request, env: Env): Promise<{ status: number; body: Record<string, unknown> }> {
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
  if (name.length < 2) return { status: 400, body: { error: "Please give your name." } };
  if (!EMAIL.test(email)) return { status: 400, body: { error: "Please give an email address we can reply to." } };
  if (message.length < 10) return { status: 400, body: { error: "Please say a little more about what you need." } };
  if (j.consent !== true) return { status: 400, body: { error: "Please confirm we may reply to you about this request." } };

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (env.ENQUIRE_LIMIT) {
    const { success } = await env.ENQUIRE_LIMIT.limit({ key: `research:${ip}` });
    if (!success) return { status: 429, body: { error: "Please wait a minute before sending another request." } };
  }
  await env.ENQUIRE_DB.prepare(
    `INSERT INTO research_requests (id, created_at, q, edition, message, name, email, organisation, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`)
    .bind(crypto.randomUUID(), new Date().toISOString(), clip(j.q, 300), clip(j.edition, 40), message, name, email, clip(j.organisation, 160))
    .run();
  return { status: 200, body: { ok: true } };
}
