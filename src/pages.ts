// Published pages of the ThinkPeople sites: read daily, split into sections, searched with FTS5.
// Stored in Enquire's own D1 database (EU jurisdiction). Only public pages of our own sites are read.

import type { Doc, EditionKey, Env, SourceAdapter } from "./types";
import { clip, isHttps, scoreDoc, stripHtml } from "./text";

interface Site {
  id: string;
  origin: string;
  name: string;
  /** which editions a page belongs to (besides "all") */
  editions: (path: string) => string[];
  skip?: RegExp;
}

export const SITES: Site[] = [
  {
    id: "thinkpeoplenexus.com", origin: "https://thinkpeoplenexus.com", name: "ThinkPeople Nexus",
    editions: (p) => p.startsWith("/shaiping-malta") ? ["thinkpeople", "shaiping"]
      : p.startsWith("/thinkpeople-you") ? ["thinkpeople", "wellbeing"]
      : p.startsWith("/skills-intelligence") ? ["thinkpeople", "observer"]
      : ["thinkpeople"],
    skip: /^\/contact/,
  },
  { id: "thinkpeople.io", origin: "https://thinkpeople.io", name: "ThinkPeople", editions: () => ["thinkpeople"], skip: /^\/enquire/ },
  { id: "leonardo2050.com", origin: "https://www.leonardo2050.com", name: "Leonardo 2050", editions: () => ["leonardo"] },
  { id: "shaipingmalta.eu", origin: "https://shaipingmalta.eu", name: "SHaiPING Malta", editions: () => ["shaiping"] },
  { id: "thinkpeople.you", origin: "https://thinkpeople.you", name: "ThinkPeople.You", editions: () => ["wellbeing"] },
  // the Observer's World News Dispatch page is private (password), so it is never read
  { id: "maltaobserver.com", origin: "https://www.maltaobserver.com", name: "Malta Observer", editions: () => ["observer"], skip: /world-news-dispatch/ },
];

const MAX_PAGES = 60;
const ID_SCHEME = 2; // section ids follow headings (2); positional ids were 1
const CHUNK = 1200;
const STALE_MS = 24 * 3600 * 1000;
const UA = "EnquireNexus/0.3 (+https://enquire.nexus; reads ThinkPeople's own public pages)";

// ---------------------------------------------------------------- reading a page

interface Section { heading: string; text: string }

function extract(html: string): { title: string; sections: Section[] } {
  const title = stripHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "");
  let body = (html.match(/<main\b[\s\S]*?<\/main>/i) || [])[0] || (html.match(/<body\b[\s\S]*<\/body>/i) || [])[0] || html;
  body = body
    .replace(/<(script|style|noscript|svg|template|form|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const sections: Section[] = [];
  let cur: Section = { heading: "", text: "" };
  const re = /<(h[1-3]|p|li|blockquote|dd|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const t = stripHtml(m[2]);
    if (!t) continue;
    if (/^h[1-3]$/i.test(m[1])) {
      if (cur.text) sections.push(cur);
      cur = { heading: clip(t, 200), text: "" };
    } else if (t.length > 25 && !cur.text.includes(t)) {
      cur.text += (cur.text ? " " : "") + t;
    }
  }
  if (cur.text) sections.push(cur);
  return { title, sections };
}

function chunks(text: string): string[] {
  if (text.length <= CHUNK) return [text];
  const out: string[] = [];
  let buf = "";
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if ((buf + " " + s).length > CHUNK && buf) { out.push(buf); buf = s; }
    else buf = buf ? `${buf} ${s}` : s;
  }
  if (buf) out.push(buf);
  return out;
}

function links(html: string, origin: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], origin + "/");
      if (u.origin !== origin) continue;
      if (/\.(pdf|jpe?g|png|webp|svg|gif|zip|mp4|mp3|xml|json|css|js|ico|txt)$/i.test(u.pathname)) continue;
      u.search = "";
      out.push(u.href);
    } catch { /* ignore */ }
  }
  return out;
}

async function getText(url: string): Promise<{ ok: boolean; html: string; type: string }> {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xml" }, redirect: "follow" });
    return { ok: r.ok, html: r.ok ? await r.text() : "", type: r.headers.get("content-type") || "" };
  } catch {
    return { ok: false, html: "", type: "" };
  }
}

// ---------------------------------------------------------------- crawling one site

type Row = { id: string; site: string; url: string; editions: string; fetched_at: string; title: string; heading: string; body: string };

const slug = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "top";

export async function crawlSite(_env: Env, site: Site): Promise<{ pages: number; rows: Row[] }> {
  const now = new Date().toISOString();
  const seeds = [site.origin + "/"];
  const sm = await getText(site.origin + "/sitemap.xml");
  if (sm.ok) {
    const locs = [...sm.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
    for (const sub of locs.filter((l) => /\.xml$/i.test(l)).slice(0, 4)) {
      const t = await getText(sub);
      if (t.ok) locs.push(...[...t.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]));
    }
    seeds.push(...locs.filter((l) => !/\.xml$/i.test(l)));
  }
  const queue = [...new Set(seeds.map((s) => { try { const u = new URL(s); u.hash = ""; u.search = ""; return u.href; } catch { return ""; } }).filter(Boolean))];
  const seen = new Set<string>();
  const seenText = new Set<string>();
  const rows: Row[] = [];
  let pages = 0;

  while (queue.length && pages < MAX_PAGES) {
    const url = queue.shift()!;
    const key = url.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const path = new URL(url).pathname;
    if (site.skip?.test(path)) continue;
    const page = await getText(url);
    if (!page.ok || !/html/i.test(page.type)) continue;
    if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(page.html)) continue;
    for (const l of links(page.html, new URL(url).origin)) if (!seen.has(l.replace(/\/$/, ""))) queue.push(l);
    const { title, sections } = extract(page.html);
    if (!sections.length) continue;
    pages++;
    const editions = ["all", ...site.editions(path)].join(" ");
    const used: Record<string, number> = {};
    for (const sec of sections) {
      // boilerplate repeated across pages (calls to action, footers) is kept once
      const sig = `${sec.heading}|${sec.text.slice(0, 160)}`;
      if (seenText.has(sig)) continue;
      seenText.add(sig);
      // ids follow the heading, not the position, so moving a section is not a change
      const h = slug(sec.heading);
      const n = (used[h] = (used[h] ?? 0) + 1);
      chunks(sec.text).forEach((c, k) => {
        rows.push({ id: `${site.id}:${path}#${h}~${n}:${k}`, site: site.id, url, editions, fetched_at: now, title: clip(title, 200), heading: sec.heading, body: c });
      });
    }
  }
  return { pages, rows };
}

const insertPage = (db: D1Database, r: Row) =>
  db.prepare("INSERT INTO pages (id, site, url, editions, fetched_at, title, heading, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(r.id, r.site, r.url, r.editions, r.fetched_at, r.title, r.heading, r.body);

async function runBatches(db: D1Database, stmts: D1PreparedStatement[]) {
  for (let k = 0; k < stmts.length; k += 80) await db.batch(stmts.slice(k, k + 80));
}

/** First read of a site (or after the id scheme changed): the copy becomes the approved baseline. */
async function writeBaseline(db: D1Database, siteId: string, rows: Row[]) {
  await runBatches(db, [db.prepare("DELETE FROM pages WHERE site = ?").bind(siteId), ...rows.map((r) => insertPage(db, r))]);
}

/** Later reads: differences are held back as pending changes for the release desk. */
async function queueChanges(db: D1Database, siteId: string, rows: Row[]): Promise<number> {
  const live = await db.prepare("SELECT id, url, editions, title, heading, body FROM pages WHERE site = ?").bind(siteId).all<Row>();
  const liveMap = new Map(live.results.map((r) => [r.id, r]));
  const declined = await db.prepare("SELECT id, change, body FROM page_changes WHERE site = ? AND status = 'declined'").bind(siteId)
    .all<{ id: string; change: string; body: string | null }>();
  const wasDeclined = (id: string, change: string, body: string | null) =>
    declined.results.some((d) => d.id === id && d.change === change && (d.body ?? "") === (body ?? ""));
  const now = new Date().toISOString();
  const pending: D1PreparedStatement[] = [];
  const push = (r: Row, change: string, old?: Row) => {
    const body = change === "remove" ? null : r.body;
    if (wasDeclined(r.id, change, body)) return;
    pending.push(db.prepare(
      `INSERT OR REPLACE INTO page_changes (id, site, url, editions, title, heading, body, old_heading, old_body, change, detected_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`)
      .bind(r.id, siteId, r.url, r.editions, r.title, change === "remove" ? r.heading : r.heading, body, old?.heading ?? null, old?.body ?? null, change, now));
  };
  const fresh = new Set<string>();
  for (const r of rows) {
    fresh.add(r.id);
    const old = liveMap.get(r.id);
    if (!old) push(r, "add");
    else if (old.body !== r.body || old.heading !== r.heading) push(r, "change", old);
  }
  for (const [id, old] of liveMap) if (!fresh.has(id)) push(old, "remove", old);
  // pending changes that no longer apply (the page went back to what is live) are dropped
  await runBatches(db, [db.prepare("DELETE FROM page_changes WHERE site = ? AND status = 'pending'").bind(siteId), ...pending]);
  return pending.length;
}

/** Crawl one site with a lock so two requests never crawl the same site at once. */
export async function refreshSite(env: Env, site: Site): Promise<void> {
  const db = env.ENQUIRE_DB;
  if (!db) return;
  const now = new Date();
  const lockUntil = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const got = await db
    .prepare(`INSERT INTO crawl_state (site, last_run, status, lock_until) VALUES (?1, ?2, 'running', ?3)
              ON CONFLICT(site) DO UPDATE SET last_run = ?2, status = 'running', lock_until = ?3
              WHERE crawl_state.lock_until IS NULL OR crawl_state.lock_until < ?2`)
    .bind(site.id, now.toISOString(), lockUntil)
    .run();
  if (!got.meta.changes) return; // someone else holds the lock
  try {
    const { pages, rows } = await crawlSite(env, site);
    if (!rows.length) throw new Error("nothing read");
    const st = await db.prepare("SELECT id_scheme FROM crawl_state WHERE site = ?").bind(site.id).first<{ id_scheme: number }>();
    const baseline = !st || (st.id_scheme ?? 1) < ID_SCHEME;
    let status = "ok";
    if (baseline) {
      await writeBaseline(db, site.id, rows);
      status = "ok · baseline";
    } else {
      const n = await queueChanges(db, site.id, rows);
      status = n ? `ok · ${n} change${n === 1 ? "" : "s"} waiting for release` : "ok";
    }
    await db.prepare("UPDATE crawl_state SET last_ok = ?2, pages = ?3, sections = ?4, status = ?5, lock_until = NULL, id_scheme = ?6 WHERE site = ?1")
      .bind(site.id, new Date().toISOString(), pages, rows.length, status, ID_SCHEME).run();
  } catch (e) {
    await db.prepare("UPDATE crawl_state SET status = ?2, lock_until = NULL WHERE site = ?1")
      .bind(site.id, `error: ${String(e).slice(0, 200)}`).run();
  }
}

/** Refresh every site whose copy is older than a day (or missing). Used by the daily schedule. */
export async function refreshStale(env: Env, limit = SITES.length): Promise<void> {
  const db = env.ENQUIRE_DB;
  if (!db) return;
  const { results } = await db.prepare("SELECT site, last_ok FROM crawl_state").all<{ site: string; last_ok: string | null }>();
  const ok = new Map(results.map((r) => [r.site, r.last_ok]));
  const stale = SITES.filter((s) => {
    const t = Date.parse(ok.get(s.id) || "");
    return !Number.isFinite(t) || Date.now() - t > STALE_MS;
  }).slice(0, limit);
  for (const s of stale) await refreshSite(env, s);
}

export async function crawlStatus(env: Env) {
  if (!env.ENQUIRE_DB) return [];
  const { results } = await env.ENQUIRE_DB.prepare("SELECT site, last_ok, pages, sections, status FROM crawl_state ORDER BY site").all();
  return results;
}

// ---------------------------------------------------------------- searching

const siteName = (id: string) => SITES.find((s) => s.id === id)?.name || id;

export const sitePages: SourceAdapter = {
  id: "site-pages",
  name: "ThinkPeople published pages",
  visibility: "public",
  async search(env: Env, q: string, terms: string[], scope: EditionKey): Promise<Doc[]> {
    const db = env.ENQUIRE_DB;
    if (!db || !terms.length) return [];
    const match = terms.map((t) => `"${t.replace(/["]/g, "").replace(/-/g, " ")}"`).join(" OR ");
    try {
      const { results } = await db
        .prepare(`SELECT id, site, url, title, heading, body, fetched_at, bm25(pages, 0, 0, 0, 0, 0, 4.0, 3.0, 1.0) AS rank
                    FROM pages WHERE pages MATCH ?1 AND (' ' || editions || ' ') LIKE ?2
                   ORDER BY rank LIMIT 40`)
        .bind(match, `% ${scope} %`)
        .all<Record<string, string>>();
      const phrase = q.toLowerCase().trim();
      const seenUrl: Record<string, number> = {};
      const out: Doc[] = [];
      for (const r of results) {
        if (!isHttps(r.url)) continue;
        if ((seenUrl[r.url] = (seenUrl[r.url] ?? 0) + 1) > 2) continue; // at most two sections from one page
        const heading = r.heading && r.heading !== r.title ? r.heading : "";
        const title = heading ? `${heading} — ${r.title}` : r.title;
        out.push({
          id: `s:${r.id}`, sourceId: "site-pages", title: clip(title, 220), text: clip(r.body, 1100),
          date: String(r.fetched_at || "").slice(0, 10), url: r.url, via: siteName(r.site), kind: "page",
          status: "Published page",
          score: scoreDoc(`${r.title} ${heading}`, r.body, terms, phrase) + 1.5,
        });
      }
      return out.filter((d) => (d.score ?? 0) > 1.5).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);
    } catch {
      return [];
    }
  },
};

// ---------------------------------------------------------------- release desk actions

export async function decidePageChanges(env: Env, ids: string[], release: boolean, by: string): Promise<number> {
  const db = env.ENQUIRE_DB!;
  const now = new Date().toISOString();
  let done = 0;
  for (const id of ids.slice(0, 500)) {
    const c = await db.prepare("SELECT * FROM page_changes WHERE id = ? AND status = 'pending'").bind(id).first<Record<string, string>>();
    if (!c) continue;
    const stmts: D1PreparedStatement[] = [];
    if (release) {
      stmts.push(db.prepare("DELETE FROM pages WHERE id = ?").bind(id));
      if (c.change !== "remove") {
        stmts.push(insertPage(db, { id, site: c.site, url: c.url, editions: c.editions, fetched_at: c.detected_at, title: c.title, heading: c.heading, body: c.body }));
      }
    }
    stmts.push(db.prepare("UPDATE page_changes SET status = ?2, decided_at = ?3, decided_by = ?4 WHERE id = ?1").bind(id, release ? "released" : "declined", now, by));
    await db.batch(stmts);
    done++;
  }
  return done;
}
