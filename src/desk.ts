// The release desk (now publish.tpnintel.com/enquire/): where Enquire's held-back material is released or declined.
// publish.tpnintel.com checks Cloudflare Access itself and passes the signed-in email over the service binding.
// Two locks: Cloudflare Access in front of the hostname, and a check here of Access's signed token,
// which must name the one allowed email address. Without both, the desk shows nothing.

import deskPage from "./desk.html";
import { decidePageChanges } from "./pages";
import { PASSAGE_SCOPE_NAMES } from "./sources";
import { clip } from "./text";
import type { Env } from "./types";

const HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow",
  "cache-control": "no-store",
};

const j = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...HEADERS } });

// ---------------------------------------------------------------- verifying Cloudflare Access

const b64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const certs = new Map<string, { at: number; keys: any[] }>();

async function accessKeys(team: string) {
  const c = certs.get(team);
  if (c && Date.now() - c.at < 3600_000 && c.keys.length) return c.keys;
  const r = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error("certs");
  const body = (await r.json()) as { keys: any[] };
  certs.set(team, { at: Date.now(), keys: body.keys });
  return body.keys;
}

/** The signed-in email if the request carries a valid Access token for the desk, otherwise null.
 *  ACCESS_TEAM_DOMAIN may list several names of the same Access team, comma separated. */
export async function deskUser(request: Request, env: Env): Promise<string | null> {
  const teams = (env.ACCESS_TEAM_DOMAIN || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  const aud = env.ACCESS_AUD, allowed = (env.DESK_EMAIL || "").toLowerCase();
  if (!teams.length || !aud || !allowed) return null;
  const cookie = (request.headers.get("cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  const token = request.headers.get("cf-access-jwt-assertion") || cookie;
  if (!token) return null;
  try {
    const [h, p, s] = token.split(".");
    const header = JSON.parse(new TextDecoder().decode(b64u(h)));
    const payload = JSON.parse(new TextDecoder().decode(b64u(p)));
    if (header.alg !== "RS256") return null;
    // the issuer must be one of our team names; its keys are then fetched from that team only
    const team = teams.find((t) => payload.iss === `https://${t}`);
    if (!team) return null;
    const jwk = (await accessKeys(team)).find((k: any) => k.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64u(s), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!auds.includes(aud)) return null;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    const email = String(payload.email || "").toLowerCase();
    return email === allowed ? email : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- the desk's API

async function body(request: Request): Promise<Record<string, any>> {
  if (Number(request.headers.get("content-length") || 0) > 64_000) throw new Error("too big");
  return (await request.json()) as Record<string, any>;
}

async function api(request: Request, env: Env, user: string, path: string): Promise<Response> {
  const db = env.ENQUIRE_DB;
  if (!db) return j({ error: "database not connected" }, 503);
  const now = new Date().toISOString();

  if (request.method === "GET" && path === "summary") {
    const one = (sql: string) => db.prepare(sql).first<{ n: number }>().then((r) => r?.n ?? 0);
    const [changes, drafts, research] = await Promise.all([
      one("SELECT COUNT(*) AS n FROM page_changes WHERE status = 'pending'"),
      one("SELECT COUNT(*) AS n FROM passages WHERE state = 'draft'"),
      one("SELECT COUNT(*) AS n FROM research_requests WHERE status = 'new'"),
    ]);
    const crawl = await db.prepare("SELECT site, last_ok, pages, sections, status FROM crawl_state ORDER BY site").all();
    return j({ user, changes, drafts, research, crawl: crawl.results, scopes: PASSAGE_SCOPE_NAMES });
  }

  // page changes
  if (request.method === "GET" && path === "changes") {
    const { results } = await db.prepare(
      `SELECT id, site, url, title, heading, body, old_heading, old_body, change, detected_at FROM page_changes
        WHERE status = 'pending' ORDER BY site, url, id LIMIT 500`).all();
    return j({ changes: results });
  }
  if (request.method === "POST" && (path === "changes/release" || path === "changes/decline")) {
    const b = await body(request);
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(String);
    const n = await decidePageChanges(env, ids, path.endsWith("release"), user);
    return j({ ok: true, decided: n });
  }

  // passages
  if (request.method === "GET" && path === "passages") {
    const { results } = await db.prepare(
      `SELECT * FROM passages ORDER BY CASE state WHEN 'draft' THEN 0 WHEN 'released' THEN 1 ELSE 2 END, updated_at DESC LIMIT 300`).all();
    return j({ passages: results });
  }
  if (request.method === "POST" && path === "passages") {
    const b = await body(request);
    const scope = String(b.scope || "");
    if (!PASSAGE_SCOPE_NAMES[scope]) return j({ error: "Choose where the passage belongs." }, 400);
    const title = clip(b.title, 200), text = clip(b.source_text, 4000);
    if (title.length < 3 || text.length < 20) return j({ error: "A passage needs a title and its source text." }, 400);
    if (b.url && !/^https:\/\//i.test(String(b.url))) return j({ error: "The link must start with https://" }, 400);
    const id = b.id ? String(b.id) : crypto.randomUUID();
    const existing = b.id ? await db.prepare("SELECT state FROM passages WHERE id = ?").bind(id).first<{ state: string }>() : null;
    // editing a released passage takes it back to draft until it is released again
    await db.prepare(
      `INSERT INTO passages (id, scope, domain, title, document, status_label, date, url, source_text, reading, uncertainty, keywords, state, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'draft', ?13, ?13)
       ON CONFLICT(id) DO UPDATE SET scope = ?2, domain = ?3, title = ?4, document = ?5, status_label = ?6, date = ?7, url = ?8,
         source_text = ?9, reading = ?10, uncertainty = ?11, keywords = ?12, state = 'draft', updated_at = ?13, decided_at = NULL, decided_by = NULL`)
      .bind(id, scope, PASSAGE_SCOPE_NAMES[scope], title, clip(b.document, 200), clip(b.status_label, 80), clip(b.date, 40),
        clip(b.url, 500), text, clip(b.reading, 2000), clip(b.uncertainty, 1000), clip(b.keywords, 300), now)
      .run();
    return j({ ok: true, id, wasReleased: existing?.state === "released" });
  }
  const pm = path.match(/^passages\/([\w-]{1,64})\/(release|decline)$/);
  if (request.method === "POST" && pm) {
    const r = await db.prepare(`UPDATE passages SET state = ?2, decided_at = ?3, decided_by = ?4 WHERE id = ?1 AND state = 'draft'`)
      .bind(pm[1], pm[2] === "release" ? "released" : "declined", now, user).run();
    return j({ ok: !!r.meta.changes });
  }

  // further-research requests
  if (request.method === "GET" && path === "research") {
    const { results } = await db.prepare(
      `SELECT * FROM research_requests ORDER BY CASE status WHEN 'new' THEN 0 ELSE 1 END, created_at DESC LIMIT 300`).all();
    return j({ requests: results });
  }
  const rm = path.match(/^research\/([\w-]{1,64})$/);
  if (request.method === "POST" && rm) {
    const b = await body(request);
    const status = ["accepted", "declined", "new"].includes(b.status) ? b.status : null;
    if (!status) return j({ error: "Unknown decision." }, 400);
    await db.prepare(`UPDATE research_requests SET status = ?2, note = ?3, decided_at = ?4, decided_by = ?5 WHERE id = ?1`)
      .bind(rm[1], status, clip(b.note, 1000), now, user).run();
    return j({ ok: true });
  }

  return j({ error: "not_found" }, 404);
}

export async function handleDesk(request: Request, env: Env, viaPublish?: string | null): Promise<Response> {
  const url = new URL(request.url);
  // through publish.tpnintel.com (binding only): that page has verified Access; the one allowed account still applies
  const passed = (viaPublish || "").trim().toLowerCase();
  const user = viaPublish !== undefined
    ? (passed && passed === (env.DESK_EMAIL || "").toLowerCase() ? passed : null)
    : await deskUser(request, env);
  if (!user) {
    return new Response("This desk is private. Sign in through ThinkPeople's Cloudflare Access with the approved account.", {
      status: 403, headers: { "content-type": "text/plain; charset=utf-8", ...HEADERS },
    });
  }
  if (url.pathname.startsWith("/desk-api/")) {
    // state-changing calls must come from the desk page itself (custom header: not sendable cross-site without CORS)
    if (request.method !== "GET" && request.headers.get("x-desk") !== "1") return j({ error: "forbidden" }, 403);
    try {
      return await api(request, env, user, url.pathname.slice("/desk-api/".length));
    } catch {
      return j({ error: "The desk could not complete that." }, 500);
    }
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(deskPage, {
      headers: {
        "content-type": "text/html; charset=utf-8", ...HEADERS,
        "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      },
    });
  }
  return new Response("Not found", { status: 404, headers: HEADERS });
}
