// The approved sources. Each adapter is read-only: it only SELECTs or GETs.
// Nothing from the voluntary-organisations (VO / OCVO) registers is connected here, by design.

import passagesData from "./data/passages.json";
import type { Doc, EditionKey, Env, SourceAdapter } from "./types";
import { clip, escapeLike, isHttps, matchCountSql, recency, scoreDoc, stripHtml } from "./text";

interface Passage {
  id: string; scope: string; domain: string; title: string; document: string; status: string; date: string;
  url: string; sourceText: string; reading: string; uncertainty: string; concepts: string[]; keywords: string;
}
const PASSAGES = passagesData as Passage[];

/** Which passage scopes each edition may read. */
const PASSAGE_SCOPES: Partial<Record<EditionKey, string[]>> = {
  all: ["thinkpeople-nexus", "humaine", "relational", "leonardo2050", "shaiping-malta"],
  thinkpeople: ["thinkpeople-nexus", "humaine"],
  leonardo: ["leonardo2050", "humaine", "relational"],
  shaiping: ["shaiping-malta"],
};

// ---------------------------------------------------------------- ThinkPeople passages
const passages: SourceAdapter = {
  id: "thinkpeople-passages",
  name: "ThinkPeople governed passages",
  visibility: "public",
  async search(_env, q, terms, scope) {
    const scopes = PASSAGE_SCOPES[scope] ?? [];
    if (!scopes.length) return [];
    const phrase = q.toLowerCase().trim();
    return PASSAGES.filter((p) => scopes.includes(p.scope))
      .map((p) => {
        const body = [p.sourceText, p.reading, p.document, p.concepts.join(" "), String(p.keywords || "")].join(" ");
        return { p, score: scoreDoc(p.title, body, terms, phrase) + 1 };
      })
      .filter((x) => x.score > 1)
      .map(({ p, score }) => ({
        id: `p:${p.id}`,
        sourceId: "thinkpeople-passages",
        title: p.title,
        text: p.sourceText,
        date: p.date,
        url: isHttps(p.url) ? p.url : "",
        via: `${p.domain} · ${p.document}`,
        kind: "passage" as const,
        status: p.status,
        score: score + 2, // curated, governed material ranks well when it matches
      }));
  },
};

// ---------------------------------------------------------------- TPN evidence engine (news)
const evidence: SourceAdapter = {
  id: "tpn-evidence",
  name: "TPN evidence engine",
  visibility: "public",
  async search(env, _q, terms, scope) {
    const db = env.EVIDENCE_DB;
    if (!db || !terms.length) return [];
    const since = new Date(Date.now() - 120 * 864e5).toISOString();
    const like = terms.map(() => "i.headline LIKE ? ESCAPE '\\'").join(" OR ");
    const malta = scope === "observer"
      ? " AND EXISTS (SELECT 1 FROM item_routes r WHERE r.item_id = i.item_id AND r.kind = 'country' AND r.value = 'malta')"
      : "";
    try {
      const { results } = await db
        .prepare(
          `SELECT i.item_id, i.headline, i.canonical_url, i.publisher_domain, i.published_at, i.cluster_id,
                  CASE WHEN i.summary_policy = 'feed-text' THEN i.summary ELSE NULL END AS summary,
                  (SELECT c.name FROM item_channels ic JOIN channels c ON c.channel_id = ic.channel_id
                    WHERE ic.item_id = i.item_id ORDER BY ic.first_seen_at LIMIT 1) AS publisher
             FROM items i
            WHERE i.date_status = 'dated' AND i.published_at >= ? AND (${like})${malta}
            ORDER BY (${matchCountSql("i.headline", terms.length)}) DESC, i.published_at DESC
            LIMIT 300`
        )
        .bind(since, ...terms.map((t) => `%${escapeLike(t)}%`), ...terms.map((t) => `%${escapeLike(t)}%`))
        .all<Record<string, string | null>>();
      const seen = new Set<string>();
      const out: Doc[] = [];
      for (const r of results) {
        if (!isHttps(r.canonical_url)) continue;
        const headline = String(r.headline || "");
        const summary = stripHtml(String(r.summary || ""));
        const s = scoreDoc(headline, summary, terms) + recency(String(r.published_at || ""), 120);
        if (s <= 0) continue;
        out.push({
          id: `e:${r.item_id}`,
          sourceId: "tpn-evidence",
          title: clip(headline, 220),
          text: clip(summary, 700),
          date: String(r.published_at || ""),
          url: String(r.canonical_url),
          via: clip(r.publisher || r.publisher_domain || "", 80),
          kind: "news",
          score: s,
          // keep cluster id on the side for one-per-story
          ...(r.cluster_id ? { status: `cluster:${r.cluster_id}` } : {}),
        });
      }
      out.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      return out.filter((d) => {
        if (!d.status?.startsWith("cluster:")) return true;
        if (seen.has(d.status)) return false;
        seen.add(d.status);
        return true;
      }).map((d) => ({ ...d, status: undefined })).slice(0, 12);
    } catch {
      return [];
    }
  },
};

// ---------------------------------------------------------------- The Corporate Times desk
const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

function ctVia(sourceId: string, company: string | null): string {
  if (sourceId.startsWith("mse-")) return "Malta Stock Exchange";
  if (sourceId.startsWith("company-ir:")) return `Investor relations · ${company || sourceId.slice(11)}`;
  if (sourceId.startsWith("company-newsrooms:")) return `Company newsroom · ${company || sourceId.slice(18)}`;
  if (sourceId === "ct-ci-cde") return "The Corporate Times";
  if (sourceId.startsWith("fiau")) return "FIAU";
  if (sourceId.startsWith("prospects")) return "Prospects MTF";
  if (sourceId.startsWith("smechamber")) return "Malta Chamber of SMEs";
  if (sourceId.startsWith("maltachamber") || sourceId.startsWith("malta-chamber")) return "The Malta Chamber";
  if (sourceId.startsWith("world-")) return titleCase(sourceId.slice(6).replace(/-/g, " "));
  return titleCase(sourceId.replace(/[-_:]+/g, " ").replace(/\bnews\b/i, "").trim());
}

const corporate: SourceAdapter = {
  id: "corporate-times",
  name: "The Corporate Times desk",
  visibility: "public",
  async search(env, _q, terms) {
    const db = env.CT_DB;
    if (!db || !terms.length) return [];
    const like = terms.map(() => "i.title LIKE ? ESCAPE '\\'").join(" OR ");
    try {
      const { results } = await db
        .prepare(
          `SELECT i.id, i.source_id, i.title, i.url, i.published, i.first_seen, i.kind, i.company_id,
                  substr(t.text, 1, 1500) AS text
             FROM items i
             LEFT JOIN item_text t ON t.source_id = i.source_id AND t.item_key = i.item_key
            WHERE i.status != 'rejected' AND (${like})
            ORDER BY (${matchCountSql("i.title", terms.length)}) DESC, COALESCE(i.published, i.first_seen) DESC
            LIMIT 200`
        )
        .bind(...terms.map((t) => `%${escapeLike(t)}%`), ...terms.map((t) => `%${escapeLike(t)}%`))
        .all<Record<string, string | null>>();
      return results
        .filter((r) => isHttps(r.url))
        .map((r) => {
          const date = String(r.published || r.first_seen || "");
          const body = stripHtml(String(r.text || ""));
          const filing = /^(mse-|company-ir:)/.test(String(r.source_id));
          return {
            id: `c:${r.id}`,
            sourceId: "corporate-times",
            title: clip(r.title, 220),
            text: clip(body, 700),
            date,
            url: String(r.url),
            via: ctVia(String(r.source_id), r.company_id),
            kind: filing ? ("filing" as const) : ("news" as const),
            score: scoreDoc(String(r.title), body, terms) + recency(date, 365),
          };
        })
        .filter((d) => d.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    } catch {
      return [];
    }
  },
};

// ---------------------------------------------------------------- cde.news (public WordPress search)
const cdenews: SourceAdapter = {
  id: "cde-news",
  name: "cde.news",
  visibility: "public",
  async search(_env, _q, terms) {
    if (!terms.length) return [];
    const get = async (words: string[]) => {
      const u = `https://public-api.wordpress.com/wp/v2/sites/cde.news/posts?per_page=10&_fields=date,link,title,excerpt&search=${encodeURIComponent(words.join(" "))}`;
      const r = await fetch(u, { headers: { accept: "application/json" }, cf: { cacheTtl: 600, cacheEverything: true } });
      if (!r.ok) return [];
      const j = (await r.json()) as Array<{ date: string; link: string; title?: { rendered?: string }; excerpt?: { rendered?: string } }>;
      return Array.isArray(j) ? j : [];
    };
    try {
      let rows = await get(terms.slice(0, 3));
      if (!rows.length && terms.length > 1) rows = await get(terms.slice(0, 1));
      return rows
        .filter((p) => isHttps(p.link))
        .map((p, i) => {
          const title = stripHtml(p.title?.rendered || "");
          const text = stripHtml(p.excerpt?.rendered || "");
          return {
            id: `w:${i}:${p.link}`,
            sourceId: "cde-news",
            title: clip(title, 220),
            text: clip(text, 700),
            date: p.date,
            url: p.link,
            via: "cde.news",
            kind: "news" as const,
            score: scoreDoc(title, text, terms) + recency(p.date, 120) + 1,
          };
        })
        .filter((d) => d.score > 1);
    } catch {
      return [];
    }
  },
};

// ---------------------------------------------------------------- Malta Observer (public figures and edition)
const OBSERVER = "https://www.maltaobserver.com";

async function getJson(url: string): Promise<any> {
  const r = await fetch(url, { headers: { accept: "application/json" }, cf: { cacheTtl: 600, cacheEverything: true } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

const observer: SourceAdapter = {
  id: "malta-observer",
  name: "Malta Observer",
  visibility: "public",
  async search(_env, q, terms) {
    const docs: Doc[] = [];
    const [glance, edition] = await Promise.allSettled([getJson(`${OBSERVER}/api/glance`), getJson(`${OBSERVER}/api/edition`)]);
    if (glance.status === "fulfilled" && glance.value?.items && typeof glance.value.items === "object") {
      for (const [key, it] of Object.entries<any>(glance.value.items)) {
        const title = `${it.label}: ${it.display}`;
        const text = [it.display, it.label, it.detail, it.change_display, it.amount_display, it.gozo_display].filter(Boolean).join(" · ") + `. Source: ${it.source}.`;
        docs.push({
          id: `o:g:${key}`, sourceId: "malta-observer", title: clip(title, 200), text: clip(text, 500),
          date: String(it.detail || glance.value.generated_at || ""), url: `${OBSERVER}/malta-insights.html`,
          via: `Malta Observer · ${it.source || "official statistics"}`, kind: "figure",
          // figures are short, so a single matching word is enough; Malta-wide questions also want them
          score: scoreDoc(title, text + " " + key, terms) + (/\b(malta|economy|economic|situation)\b/i.test(q) ? 3 : 0),
        });
      }
    }
    if (edition.status === "fulfilled") {
      const e = edition.value || {};
      const lists: Array<[string, any[]]> = [
        ["Malta Observer · World News Dispatch", e.dispatch?.items ?? []],
        ["Malta Observer · Meridian context", e.meridian?.items ?? []],
      ];
      for (const [label, items] of lists) {
        for (const it of items) {
          if (!isHttps(it.source_url)) continue;
          const title = String(it.headline || "");
          const text = [it.summary, it.theme].filter(Boolean).join(" · ");
          docs.push({
            id: `o:e:${it.id}`, sourceId: "malta-observer", title: clip(title, 220), text: clip(text, 500),
            date: String(it.period || it.observed_at || ""), url: it.source_url,
            via: `${it.source_name || "source"} · via ${label}`, kind: "news",
            score: scoreDoc(title, text, terms) + (/\bmalta\b/i.test(q) ? 1 : 0),
          });
        }
      }
    }
    return docs.filter((d) => (d.score ?? 0) > 0);
  },
};

export const ADAPTERS: Record<string, SourceAdapter> = {
  [passages.id]: passages,
  [evidence.id]: evidence,
  [corporate.id]: corporate,
  [cdenews.id]: cdenews,
  [observer.id]: observer,
};
