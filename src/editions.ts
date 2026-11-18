// The editions: one engine, several front doors. Each edition chooses which approved sources it reads.

import type { EditionKey } from "./types";

export interface Edition {
  key: EditionKey;
  name: string;
  domain: string;
  sources: string[];          // adapter ids from sources.ts
  members?: boolean;          // sign-in required
  notYet?: string;            // honest message while an edition's sources are not yet connected
}

export const EDITIONS: Record<EditionKey, Edition> = {
  all: { key: "all", name: "All of Enquire", domain: "enquire.nexus",
    sources: ["thinkpeople-passages", "tpn-evidence", "cde-news", "corporate-times", "malta-observer"] },
  news: { key: "news", name: "News", domain: "enquire.news",
    sources: ["tpn-evidence", "cde-news", "corporate-times"] },
  observer: { key: "observer", name: "Malta Observer", domain: "enquire.observer",
    sources: ["malta-observer", "tpn-evidence"] },
  thinkpeople: { key: "thinkpeople", name: "ThinkPeople Nexus", domain: "enquire.thinkpeople.io",
    sources: ["thinkpeople-passages"] },
  shaiping: { key: "shaiping", name: "SHaiPING Malta", domain: "enquire.shaipingmalta.eu",
    sources: ["thinkpeople-passages"] },
  leonardo: { key: "leonardo", name: "Leonardo 2050", domain: "enquire.leonardo2050.com",
    sources: ["thinkpeople-passages"] },
  wellbeing: { key: "wellbeing", name: "Wellbeing", domain: "enquire.thinkpeople.you", sources: [],
    notYet: "The Wellbeing edition will read the published WBGI snapshots. That connection is not switched on yet, so this path cannot answer today." },
  rooms: { key: "rooms", name: "Members’ rooms", domain: "enquire.nexus", sources: [], members: true,
    notYet: "The members’ rooms open after sign-in. Sign-in is not switched on yet." },
};

const HOSTS: Record<string, EditionKey> = {
  "enquire.news": "news",
  "enquire.observer": "observer",
  "enquire.thinkpeople.io": "thinkpeople",
  "enquire.leonardo2050.com": "leonardo",
  "enquire.shaipingmalta.eu": "shaiping",
  "enquire.thinkpeople.you": "wellbeing",
};

/** The edition a request asks for: an explicit choice on enquire.nexus, otherwise the host's own edition. */
export function editionFor(host: string, asked: string | null): Edition {
  const own = HOSTS[host.toLowerCase()];
  if (own) return EDITIONS[own];                       // an edition domain always answers as itself
  const key = (asked || "all") as EditionKey;
  return EDITIONS[key] ?? EDITIONS.all;
}
