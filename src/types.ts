// Shared shapes for the Enquire engine.

export interface Env {
  ASSETS: Fetcher;
  EVIDENCE_DB?: D1Database;      // tpn-evidence (EU): read-only by rule, SELECT only
  CT_DB?: D1Database;            // ct-corporate-sources (EU): read-only by rule, SELECT only
  ENQUIRE_DB?: D1Database;       // enquire-nexus (EU): Enquire's own copy of the published pages
  ENQUIRE_LIMIT?: RateLimit;     // per-visitor limit
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_WORKSPACE_ID?: string;
  CLAUDE_MODEL?: string;
}

export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export type Visibility = "public" | "members";

export type EditionKey =
  | "all" | "news" | "observer" | "thinkpeople" | "shaiping" | "leonardo" | "wellbeing" | "rooms";

/** One retrieved piece of evidence, before it is numbered for the answer. */
export interface Doc {
  id: string;            // unique within one enquiry
  sourceId: string;      // the approved source it came from
  title: string;
  text: string;          // what the model may read (feed text, passage text, figure detail)
  date: string;          // ISO date or a readable period
  url: string;           // where a reader can check it ("" when the source has no public link)
  via: string;           // publisher or document name, shown to the reader
  kind: "news" | "passage" | "page" | "figure" | "filing" | "analysis";
  status?: string;       // governance status for passages (e.g. "Editorial working draft")
  score?: number;
}

export interface SourceAdapter {
  id: string;
  name: string;
  visibility: Visibility;
  /** Return candidate docs for the search terms; never throw (return [] on failure). */
  search(env: Env, q: string, terms: string[], scope: EditionKey): Promise<Doc[]>;
}
