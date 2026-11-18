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

export async function crawlSite(env: Env, site: Site): Promise<{ pages: number; sections: number }> {
  const db = env.ENQUIRE_DB!;
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
  const rows: Array<[string, string, string, string, string, string, string, string]> = [];
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
    let i = 0;
    for (const s of sections) {
      // boilerplate repeated across pages (calls to action, footers) is kept once
      const sig = `${s.heading}|${s.text.slice(0, 160)}`;
      if (seenText.has(sig)) continue;
      seenText.add(sig);
      for (const c of chunks(s.text)) {
        rows.push([`${site.id}:${path}:${i++}`, site.id, url, editions, now, clip(title, 200), s.heading, c]);
      }
    }
  }

  // replace this site's pages in one batch
  const stmts = [db.prepare("DELETE FROM pages WHERE site = ?").bind(site.id)];
  for (const r of rows) {
    stmts.push(db.prepare("INSERT INTO pages (id, site, url, editions, fetched_at, title, heading, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(...r));
  }
  for (let k = 0; k < stmts.length; k += 80) await db.batch(stmts.slice(k, k + 80));
  return { pages, sections: rows.length };
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
    const r = await crawlSite(env, site);
    await db.prepare("UPDATE crawl_state SET last_ok = ?2, pages = ?3, sections = ?4, status = 'ok', lock_until = NULL WHERE site = ?1")
      .bind(site.id, new Date().toISOString(), r.pages, r.sections).run();
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
