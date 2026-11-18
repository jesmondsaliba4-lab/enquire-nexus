// Small text helpers shared by the source adapters.

const STOP = new Set(
  ("a an and are as at be by can could did do does for from had has have how i in into is it its me my of on or our " +
    "should tell that the their them there these this those to was we were what when where which who why will with would you your " +
    "about latest news today week year please give show explain describe current currently now recent recently").split(" ")
);
const SHORT_OK = new Set(["eu", "uk", "us", "un", "ai", "hr", "gdp", "pm", "mp", "mse", "nso", "wbgi", "pfri"]);

/** Distinct, meaningful search words from a question (at most 8). */
export function searchTerms(query: string): string[] {
  const text = String(query || "").toLowerCase().normalize("NFKC");
  // keep hyphenated names whole as well ("co-wisdom", "e-commerce")
  const joined = text.match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)+/gu) ?? [];
  const words = [...joined, ...text.split(/[^\p{L}\p{N}]+/u)]
    .filter((w) => w && !STOP.has(w) && (w.includes("-") || w.length >= 3 || /^\p{N}+$/u.test(w) || SHORT_OK.has(w)));
  return [...new Set(words)].slice(0, 8);
}

export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** Term-overlap score: headline hits weigh most, then body, then a whole-phrase bonus. */
export function scoreDoc(title: string, body: string, terms: string[], phrase = ""): number {
  const t = title.toLowerCase();
  const b = body.toLowerCase();
  let score = 0;
  let hits = 0;
  for (const term of terms) {
    const inTitle = t.includes(term);
    const inBody = b.includes(term);
    if (inTitle) score += 4;
    if (inBody) score += 1.5;
    if (inTitle || inBody) hits += 1;
  }
  if (!hits) return 0;
  score += hits * hits; // reward covering more of the question
  // names that span two words ("malta chamber", "budget 2027") count extra when they appear together
  for (let i = 0; i + 1 < terms.length; i++) {
    const pair = `${terms[i]} ${terms[i + 1]}`;
    if (t.includes(pair)) score += 5;
    else if (b.includes(pair)) score += 2;
  }
  if (phrase.length > 6 && (t.includes(phrase) || b.includes(phrase))) score += 8;
  return score;
}

/** A light recency bonus (0–2) for dated material within `days`. */
export function recency(iso: string, days: number, now = Date.now()): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, 1 - (now - t) / (days * 864e5)) * 2;
}

export const clip = (s: unknown, n: number) => {
  const v = String(s ?? "").replace(/\s+/g, " ").trim();
  return v.length > n ? v.slice(0, n - 1).trimEnd() + "…" : v;
};

export const stripHtml = (s: string) =>
  String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, " ")
    .trim();

export const isHttps = (u: unknown) => /^https:\/\/[^\s"'<>]+$/i.test(String(u || ""));

/** SQL fragment ranking rows by how many of the terms a column contains (one bound parameter per term). */
export function matchCountSql(column: string, n: number): string {
  return Array.from({ length: n }, () => `(CASE WHEN ${column} LIKE ? ESCAPE '\\' THEN 1 ELSE 0 END)`).join(" + ");
}
