// The WBGI (wellbeing) observatory: only the current, human-approved release is read.
// Signals waiting for review, drafts and the observatory's working tables are never touched.

import type { Doc, Env, SourceAdapter } from "./types";
import { clip, isHttps, scoreDoc } from "./text";

const PUBLIC_PAGE = "https://thinkpeople.you/#evidence"; // where the approved figures are published
const WELLBEING = /\b(well-?being|life|satisf\w*|trust\w*|poverty|exclusion|deprivation|happ\w*|lonel\w*|social)\b/i;

const fmt = (v: unknown, unit: string) => {
  if (v === null || v === undefined || v === "") return "n/a";
  const n = Number(v);
  const s = Number.isFinite(n) ? n.toFixed(1).replace(/\.0$/, ".0") : String(v);
  return unit === "%" ? `${s}%` : unit ? `${s}${unit}` : s;
};

const day = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Malta" }).format(new Date(t)) : iso;
};

export const wbgi: SourceAdapter = {
  id: "wbgi",
  name: "WBGI approved release",
  visibility: "public",
  async search(env: Env, q: string, terms: string[], scope) {
    const db = env.WBGI_DB;
    if (!db) return [];
    try {
      const rel = await db
        .prepare(`SELECT r.id, r.snapshot_date, r.published_at FROM governed_snapshot_current c
                    JOIN governed_snapshot_releases r ON r.id = c.release_id WHERE c.singleton_key = 'current'`)
        .first<{ id: string; snapshot_date: string; published_at: string }>();
      if (!rel) return [];
      const [metrics, media] = await Promise.all([
        db.prepare(`SELECT metric_id, title, dataset, unit, period, malta_value, eu_value, peer_label, peer_value, flags
                      FROM governed_snapshot_metrics WHERE release_id = ?`).bind(rel.id).all<Record<string, any>>(),
        db.prepare(`SELECT item_id, source_title, title, url, published_at, summary FROM governed_snapshot_admitted_media
                     WHERE release_id = ? ORDER BY COALESCE(published_at, discovered_at) DESC LIMIT 40`).bind(rel.id).all<Record<string, any>>(),
      ]);
      const status = `Approved WBGI release · ${day(rel.snapshot_date)}`;
      const topical = WELLBEING.test(q) || scope === "wellbeing";
      const docs: Doc[] = [];
      for (const m of metrics.results) {
        const unit = String(m.unit || "");
        const title = `${m.title}: ${fmt(m.malta_value, unit)} in Malta (${m.period})`;
        const text = `${m.title} in Malta: ${fmt(m.malta_value, unit)} in ${m.period}. EU average ${fmt(m.eu_value, unit)}.` +
          (m.peer_label ? ` Comparison country ${m.peer_label}: ${fmt(m.peer_value, unit)}.` : "") +
          ` Source: Eurostat, dataset ${m.dataset}, ${m.period}.` + (m.flags ? ` Flags: ${m.flags}.` : "") +
          ` Part of the WBGI release ${rel.id}, approved and published on ${day(rel.published_at)}.`;
        docs.push({
          id: `w:${rel.id}:${m.metric_id}`, sourceId: "wbgi", title, text, date: String(m.period), url: PUBLIC_PAGE,
          via: "ThinkPeople.You · WBGI release", kind: "figure", status,
          score: scoreDoc(title, text, terms) + (topical ? 4 : 0),
        });
      }
      for (const a of media.results) {
        if (!isHttps(a.url)) continue;
        const title = clip(a.title, 220);
        const text = clip(a.summary || "", 600);
        docs.push({
          id: `w:${rel.id}:${a.item_id}`, sourceId: "wbgi", title, text, date: String(a.published_at || ""), url: a.url,
          via: `${a.source_title || "source"} · admitted to the WBGI release`, kind: "news", status,
          score: scoreDoc(title, text, terms) + (topical ? 1 : 0),
        });
      }
      return docs.filter((d) => (d.score ?? 0) > 0);
    } catch {
      return [];
    }
  },
};
