// Writing the answer: Claude reads only the numbered sources and replies in the house format.

import type { Doc, Env } from "./types";
import { clip } from "./text";

export interface Answer {
  nothing_found: boolean;
  summary: string;
  points: { text: string; cites: number[] }[];
  uncertainty: string;
}

const SYSTEM = `You are Enquire, the governed research assistant of ThinkPeople Nexus (enquire.nexus).
You answer the reader's question using ONLY the numbered SOURCES provided. Rules:
- Every statement must come from a source and cite it by number. Never add facts, figures, names or dates the sources do not state.
- Keep three things apart: what the sources say (the points), your reading of them (the summary), and what they leave open (uncertainty).
- If the sources do not answer the question, set "nothing_found" to true, say so plainly in the summary, and leave points empty. Do not guess.
- Sources of kind "passage" are ThinkPeople's own governed texts. If a passage's status says it is a working draft or still developing, say so when you use it.
- Sources of kind "figure" are official statistics shown by the Malta Observer: quote the figure with its period and its source.
- Sources of kind "news" and "filing" are reporting and company filings: say "reported by" or "in a filing" and prefer the most recent.
- Anything labelled Meridian is ThinkPeople Nexus analysis; present it as Meridian's reading, never as established fact.
- British English, plain and neutral. No opinions, predictions or advice. Money as €12.5 million; percentages as 7.3%.
- Reply with valid JSON only, no other text:
{"nothing_found": false, "summary": "two or three sentences", "points": [{"text": "one fact from the sources", "cites": [1, 3]}], "uncertainty": "one or two sentences on what the sources do not settle"}
- Give 3 to 7 points. Inside JSON strings use single quotes, never double quotes.`;

function sourceBlock(docs: Doc[]): string {
  return docs
    .map((d, i) => {
      const head = `[${i + 1}] (${d.kind}${d.status ? `, status: ${d.status}` : ""}) ${d.title} — ${d.via}${d.date ? `, ${d.date.slice(0, 10)}` : ""}`;
      return `${head}\n${clip(d.text || d.title, 900)}`;
    })
    .join("\n\n");
}

function parse(text: string): Answer {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no json");
  const raw = text.slice(a, b + 1);
  let j: any;
  try {
    j = JSON.parse(raw);
  } catch {
    // a common slip: an unescaped double quote inside a string; strip smart repairs and retry once
    j = JSON.parse(raw.replace(/[“”]/g, "'"));
  }
  return {
    nothing_found: !!j.nothing_found,
    summary: clip(j.summary, 1200),
    points: (Array.isArray(j.points) ? j.points : []).slice(0, 8).map((p: any) => ({
      text: clip(p?.text, 700),
      cites: (Array.isArray(p?.cites) ? p.cites : []).map(Number).filter((n: number) => Number.isInteger(n)),
    })).filter((p: { text: string }) => p.text),
    uncertainty: clip(j.uncertainty, 600),
  };
}

export async function writeAnswer(env: Env, question: string, editionName: string, docs: Doc[]): Promise<Answer> {
  const today = new Date().toISOString().slice(0, 10);
  const user = `TODAY: ${today}\nEDITION: ${editionName}\nQUESTION: ${question}\n\nSOURCES\n${sourceBlock(docs)}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": String(env.ANTHROPIC_API_KEY),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      ...(env.ANTHROPIC_WORKSPACE_ID ? { "anthropic-workspace-id": env.ANTHROPIC_WORKSPACE_ID } : {}),
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL || "claude-sonnet-5-5",
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`claude ${res.status}`);
  const j = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (j.content ?? []).map((c) => c.text ?? "").join("");
  const answer = parse(text);
  // keep only citations that point at a real source
  const n = docs.length;
  answer.points = answer.points.map((p) => ({ ...p, cites: p.cites.filter((c) => c >= 1 && c <= n).slice(0, 4) }));
  return answer;
}
