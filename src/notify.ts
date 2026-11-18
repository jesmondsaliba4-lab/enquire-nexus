// Email the desk when a research request arrives (Cloudflare Email Routing, send_email binding).
// The binding can only send to the verified address in wrangler.jsonc, so nothing here can mail anyone else.
// cde.news is skipped: its own site already emails the desk.

import { EmailMessage } from "cloudflare:email";
import type { Env } from "./types";

export interface SavedRequest {
  id: string; source: string; q: string; edition: string; message: string;
  name: string; email: string; organisation: string; created_at: string;
}

const SELF_MAILING = new Set(["cde.news"]);

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const header = (s: string) => `=?UTF-8?B?${b64(s.replace(/[\r\n]+/g, " "))}?=`;
const wrap = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");

export async function notifyDesk(env: Env, r: SavedRequest): Promise<void> {
  if (!env.MAILER || SELF_MAILING.has(r.source)) return;
  const to = env.DESK_EMAIL || "jes@thinkpeople.eu";
  const from = env.MAIL_FROM || "desk@enquire.nexus";
  const subject = `[Enquire · ${r.source}] Research request: ${(r.q || r.message).slice(0, 80)}`;
  const body = [
    `A research request has arrived from ${r.source}.`,
    "",
    `Question: ${r.q || "(none)"}`,
    r.edition ? `Edition: ${r.edition}` : "",
    "",
    "What the reader needs:",
    r.message,
    "",
    `Name: ${r.name || "(not given)"}`,
    `Email: ${r.email}`,
    r.organisation ? `Organisation: ${r.organisation}` : "",
    `Received: ${r.created_at}`,
    "",
    "Reply to this email to answer the reader directly.",
    "All requests: https://release.tpnintel.com/ (Research requests)",
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\r\n");
  const safeReply = /^[^\s@<>()",;]{1,64}@[^\s@<>()",;]{1,190}$/.test(r.email) ? r.email : "";
  const raw = [
    `From: ${header("Enquire release desk")} <${from}>`,
    `To: <${to}>`,
    safeReply ? `Reply-To: ${r.name ? header(r.name) + " " : ""}<${safeReply}>` : "",
    `Subject: ${header(subject)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${r.id}@enquire.nexus>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(body)),
  ].filter((l, i) => l !== "" || i >= 8).join("\r\n");
  try {
    await env.MAILER.send(new EmailMessage(from, to, raw));
  } catch (e) {
    console.log("desk email not sent", String(e).slice(0, 200));
  }
}
