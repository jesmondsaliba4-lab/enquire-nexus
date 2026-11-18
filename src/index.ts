// Enquire · enquire.nexus — the gateway Worker.
//   GET /api/enquire?q=…&edition=…   one governed answer, with its numbered sources
//   GET /api/editions                 the editions and what each reads
//   GET /health                       service status
// Everything else is the static site in /public.

import { writeAnswer } from "./answer";
import { EDITIONS, editionFor } from "./editions";
import { ADAPTERS } from "./sources";
import { crawlStatus, refreshStale } from "./pages";
import { searchTerms, clip } from "./text";
import type { Doc, Env } from "./types";

const VERSION = "0.3.1";
const CACHE_SECONDS = 3 * 3600;
const MAX_SOURCES = 14;
const MAX_PER_SOURCE = 6;

const SECURITY: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...SECURITY, ...extra },
  });
}

/** Pick the strongest documents, at most MAX_PER_SOURCE from any one source, MAX_SOURCES in all. */
function select(docs: Doc[]): Doc[] {
  const sorted = [...docs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const per: Record<string, number> = {};
  const seenTitles = new Set<string>();
  const out: Doc[] = [];
  for (const d of sorted) {
    const t = d.title.toLowerCase().slice(0, 70);
    if (seenTitles.has(t)) continue;
    if ((per[d.sourceId] = (per[d.sourceId] ?? 0) + 1) > MAX_PER_SOURCE) continue;
    seenTitles.add(t);
    out.push(d);
    if (out.length >= MAX_SOURCES) break;
  }
  return out;
}

async function enquire(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 300);
  const edition = editionFor(url.hostname, url.searchParams.get("edition"));
  const base = { q, edition: { key: edition.key, name: edition.name, domain: edition.domain }, version: VERSION };

  if (q.length < 3) return json({ ...base, error: "Please type a question." }, 400);
  if (edition.members) return json({ ...base, error: edition.notYet, signIn: true }, 401);
  if (edition.notYet) return json({ ...base, nothing_found: true, summary: edition.notYet, points: [], uncertainty: "", sources: [] });

  // served from cache when the same question was asked of the same edition recently
  const cacheKey = new Request(`https://enquire-cache.internal/v2?e=${edition.key}&q=${encodeURIComponent(q.toLowerCase())}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) {
    const body = (await hit.json()) as Record<string, unknown>;
    return json({ ...body, cached: true });
  }

  // keep the published pages fresh: at most one stale site is re-read, after the answer is sent
  ctx.waitUntil(refreshStale(env, 1));

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (env.ENQUIRE_LIMIT) {
    const { success } = await env.ENQUIRE_LIMIT.limit({ key: ip });
    if (!success) return json({ ...base, error: "You have asked a lot of questions in a short time. Please wait a minute and try again." }, 429);
  }

  const terms = searchTerms(q);
  if (!terms.length) return json({ ...base, error: "Please ask a little more specifically." }, 400);

  const found = await Promise.all(
    edition.sources.map((id) => ADAPTERS[id]?.search(env, q, terms, edition.key).catch(() => [] as Doc[]) ?? Promise.resolve([]))
  );
  const docs = select(found.flat());
  const sources = docs.map((d, i) => ({
    n: i + 1, title: d.title, via: d.via, date: d.date, url: d.url, kind: d.kind,
    ...(d.status ? { status: d.status } : {}),
    excerpt: clip(d.text, d.kind === "passage" ? 420 : 260),
  }));
  const at = new Date().toISOString();

  if (!docs.length) {
    return json({
      ...base, at, nothing_found: true, points: [], uncertainty: "", sources: [],
      summary: `Enquire found nothing on this in the ${edition.name} sources. Try other words, or choose a broader path.`,
    });
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ ...base, at, error: "Answers are not switched on yet. Here are the sources Enquire found.", sources }, 503);
  }

  try {
    const answer = await writeAnswer(env, q, edition.name, docs);
    const body = { ...base, at, ...answer, sources };
    ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json", "cache-control": `public, max-age=${CACHE_SECONDS}` },
    })));
    return json(body);
  } catch {
    return json({ ...base, at, error: "Enquire could not write an answer just now. The sources it found are below; please try again in a minute.", sources }, 502);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({
        service: "enquire-nexus", version: VERSION, ok: true,
        sources: { evidence: !!env.EVIDENCE_DB, corporate: !!env.CT_DB, pages: !!env.ENQUIRE_DB, wbgi: !!env.WBGI_DB, answers: !!env.ANTHROPIC_API_KEY, limit: !!env.ENQUIRE_LIMIT },
      });
    }
    if (url.pathname === "/api/pages") {
      // status of the published-page copy; also nudges one stale site to refresh (never more than once a day each)
      ctx.waitUntil(refreshStale(env, 1));
      return json({ version: VERSION, sites: await crawlStatus(env) });
    }
    if (url.pathname === "/api/editions") {
      const list = Object.values(EDITIONS).map((e) => ({
        key: e.key, name: e.name, domain: e.domain, members: !!e.members, available: !e.notYet,
        sources: e.sources.map((id) => ADAPTERS[id]?.name).filter(Boolean),
      }));
      return json({ version: VERSION, editions: list }, 200, { "cache-control": "public, max-age=300" });
    }
    if (url.pathname === "/api/enquire") {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      return enquire(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },

  // daily: re-read the published pages of the ThinkPeople sites
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshStale(env));
  },
};
