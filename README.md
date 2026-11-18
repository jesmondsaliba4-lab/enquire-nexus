# Enquire · enquire.nexus

The Enquire gateway: one engine behind enquire.nexus and its editions
(enquire.news, enquire.observer, enquire.thinkpeople.io, enquire.leonardo2050.com,
enquire.shaipingmalta.eu, enquire.thinkpeople.you).

Deployed by Cloudflare Workers Builds on every push to `main`.

## How it answers

Every answer keeps three things apart: what the **sources** say, Enquire's **reading** of them
(with numbered citations), and the **uncertainty** they leave. When nothing matches, it says so.

## Layout

- `public/` — the site (landing page, map pins, enquiry box). `app.js` is generated: edit
  `tools/app.template.js` or `tools/icons.py`, then run `npm run build:app`.
- `src/index.ts` — routes: `/api/enquire`, `/api/editions`, `/health`; everything else is static.
- `src/editions.ts` — the editions and which approved sources each one reads.
- `src/sources.ts` — the approved, read-only sources:
  - ThinkPeople governed passages (from thinkpeople.io Enquire, `src/data/passages.json`)
  - TPN evidence engine (D1 `tpn-evidence`, EU)
  - The Corporate Times desk (D1 `ct-corporate-sources`, EU)
  - cde.news (public WordPress search)
  - Malta Observer (public `/api/glance` and `/api/edition`)
  - ThinkPeople published pages (`src/pages.ts`): the public pages of thinkpeoplenexus.com,
    thinkpeople.io, leonardo2050.com, shaipingmalta.eu, thinkpeople.you and maltaobserver.com,
    re-read daily into Enquire's own D1 `enquire-nexus` (EU) and searched with full-text search
- `src/answer.ts` — the answer, written by Claude from the numbered sources only.

The VO / OCVO registers are never connected. The engine only reads (SELECT / GET).

## Settings

- Secret `ANTHROPIC_API_KEY` (Cloudflare dashboard › Worker › Settings › Variables and Secrets).
- `CLAUDE_MODEL` in `wrangler.jsonc`.
- Rate limit: 12 fresh enquiries a minute per visitor; answers are cached for 3 hours.

## Releases

- **0.3** — published pages of the ThinkPeople sites, read daily (cron 03:41 UTC) and on demand;
  the Wellbeing edition answers from ThinkPeople.You; `/api/pages` shows the crawl status.
- **0.2** — the engine: five approved sources, governed answers, the landing page with the
  edition map, logo and icons. Wellbeing (WBGI) and the members' rooms are marked as to follow.
- **0.1** — holding page and `/health`.
