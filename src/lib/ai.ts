import type { AiAnswer, Email } from "../types";
import {
  DEFAULT_PERSONALIZATION,
  composeBody,
  type Personalization,
} from "./personalization";
import { detectMeetingRequest, meetingReasonText } from "./meetingIntent";
import { groupThreads, type Thread } from "./threads";
import { focusThreads, threadPriority } from "./priority";
import { extractActionItems } from "./actionItems";
import { extractCommitments } from "./commitments";

// AI assist: summarize, instant reply, write-with-AI, ask-inbox Q&A, auto
// labels, auto-archive suggestions, and follow-up drafts.
//
// Every feature has a deterministic LOCAL fallback so the app is fully usable
// offline and in tests/builds. When VITE_AI_PROVIDER + VITE_AI_API_KEY are set,
// the same functions would route to a hosted model (Anthropic/OpenAI). The
// provider call is intentionally NOT executed in dev/CI to avoid requiring paid
// credentials — see aiComplete().

export interface AiConfig {
  provider: string; // "anthropic" | "openai" | ""
  apiKey: string;
  model: string;
  enabled: boolean;
}

export function loadAiConfig(): AiConfig {
  const env = import.meta.env;
  const provider = (env.VITE_AI_PROVIDER ?? "").trim();
  return {
    provider,
    apiKey: env.VITE_AI_API_KEY ?? "",
    model: env.VITE_AI_MODEL ?? "claude-opus-4-8",
    enabled: !!provider && !!env.VITE_AI_API_KEY,
  };
}

// ---- Summarize ------------------------------------------------------------

const STOPWORDS = new Set(
  "the a an and or but to of in on for with at by from is are was were be been being this that it as your you we i our".split(
    " "
  )
);

function sentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Extractive summary: score sentences by salient-word frequency, keep the top 1–2.
export function summarize(email: Email, maxSentences = 2): string {
  const sents = sentences(email.body);
  if (sents.length <= 1) {
    const one = sents[0] ?? email.preview;
    return `Summary: ${email.from.name} — ${one.slice(0, 180)}`;
  }
  const freq = new Map<string, number>();
  for (const w of email.body.toLowerCase().match(/[a-z']+/g) ?? []) {
    if (STOPWORDS.has(w) || w.length < 3) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const scored = sents.map((s, i) => {
    let score = 0;
    for (const w of s.toLowerCase().match(/[a-z']+/g) ?? []) score += freq.get(w) ?? 0;
    return { s, i, score: score / Math.sqrt(s.length + 1) - i * 0.01 };
  });
  const top = scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
  return `Summary: ${top.join(" ")}`;
}

// Score and return the top `max` sentences of a corpus, in original order.
function topSentences(corpus: string, max: number): string[] {
  const sents = sentences(corpus);
  if (sents.length <= max) return sents;
  const freq = new Map<string, number>();
  for (const w of corpus.toLowerCase().match(/[a-z']+/g) ?? []) {
    if (STOPWORDS.has(w) || w.length < 3) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const scored = sents.map((s, i) => {
    let score = 0;
    for (const w of s.toLowerCase().match(/[a-z']+/g) ?? []) score += freq.get(w) ?? 0;
    return { s, i, score: score / Math.sqrt(s.length + 1) };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);
}

function byDateAsc(a: Email, b: Email): number {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

function firstQuestion(text: string): string {
  const s = sentences(text).find((x) => x.includes("?"));
  return (s ?? "").slice(0, 140);
}

// Summarize an entire conversation (not just one message). Notes how many people
// and messages are involved, gives an extractive gist across the whole thread,
// and surfaces the most recent open ask.
export function summarizeThread(messages: Email[], maxSentences = 3): string {
  if (!messages.length) return "Summary: (empty thread)";
  if (messages.length === 1) return summarize(messages[0]);
  const chrono = [...messages].sort(byDateAsc);
  const people = [...new Set(chrono.filter((m) => !m.outbound).map((m) => m.from.name.split(" ")[0]))];
  const whoCount = people.length || 1;
  const corpus = chrono.map((m) => m.body).join(" ");
  const top = topSentences(corpus, maxSentences);
  const who = people.length ? ` (${people.join(", ")})` : "";
  const head = `Summary · ${chrono.length} messages, ${whoCount} ${whoCount === 1 ? "person" : "people"}${who}:`;
  const lastAsk = [...chrono].reverse().find((m) => !m.outbound && asksQuestion(m.body));
  const askLine = lastAsk
    ? ` ↪ Latest ask from ${lastAsk.from.name.split(" ")[0]}: “${firstQuestion(lastAsk.body)}”`
    : "";
  return `${head} ${top.join(" ")}${askLine}`;
}

// ---- "Catch me up" inbox digest -------------------------------------------

export interface InboxDigest {
  total: number; // inbox (non-archived/trashed) message count
  unread: number;
  needsReply: Email[]; // unread inbound that asks something of you
  awaitingReply: Email[]; // threads where we sent the last message
  important: Email[]; // unread, important-category
  newsletters: number; // news/social still in the inbox
  topSenders: { name: string; count: number }[];
}

// Threads whose most-recent message is one we sent (so we're waiting on them).
export function awaitingReplyMessages(emails: Email[]): Email[] {
  const byThread = new Map<string, Email[]>();
  for (const e of emails) {
    const b = byThread.get(e.threadId);
    if (b) b.push(e);
    else byThread.set(e.threadId, [e]);
  }
  const out: Email[] = [];
  for (const msgs of byThread.values()) {
    const sorted = [...msgs].sort(byDateAsc);
    const last = sorted[sorted.length - 1];
    if (last.outbound && !last.archived && !last.trashed) out.push(last);
  }
  return out;
}

export function inboxDigest(emails: Email[], _now = 0): InboxDigest {
  const inbox = emails.filter((e) => !e.archived && !e.trashed && e.labels.indexOf("Spam") === -1);
  const unread = inbox.filter((e) => !e.read && !e.outbound);
  const needsReply = needsReplyCandidates(emails);
  const awaitingReply = awaitingReplyMessages(emails);
  const important = unread.filter((e) => e.category === "important");
  const newsletters = inbox.filter((e) => e.category === "news" || e.category === "social").length;

  const counts = new Map<string, number>();
  for (const e of inbox) {
    if (e.outbound) continue;
    counts.set(e.from.name, (counts.get(e.from.name) ?? 0) + 1);
  }
  const topSenders = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 4);

  return {
    total: inbox.filter((e) => !e.outbound).length,
    unread: unread.length,
    needsReply,
    awaitingReply,
    important,
    newsletters,
    topSenders,
  };
}

const titleOf = (e: Email) => `“${e.subject}” (${e.from.name.split(" ")[0]})`;

// Render a digest as a readable multi-line briefing.
export function formatDigest(d: InboxDigest): string {
  const lines: string[] = [];
  lines.push(
    `You have ${d.total} message${d.total === 1 ? "" : "s"} in the inbox, ${d.unread} unread.`
  );
  if (d.needsReply.length) {
    lines.push(
      `🔴 ${d.needsReply.length} need${d.needsReply.length === 1 ? "s" : ""} a reply: ` +
        d.needsReply.slice(0, 4).map(titleOf).join("; ")
    );
  } else {
    lines.push("🟢 Nothing looks like it's waiting on a reply from you.");
  }
  if (d.awaitingReply.length) {
    lines.push(
      `⏳ ${d.awaitingReply.length} awaiting a reply from others: ` +
        d.awaitingReply.slice(0, 4).map((e) => `“${e.subject}”`).join("; ")
    );
  }
  if (d.important.length) {
    lines.push(`⭐ ${d.important.length} unread in Important.`);
  }
  if (d.newsletters) {
    lines.push(`🗞 ${d.newsletters} newsletter/social message${d.newsletters === 1 ? "" : "s"} you can clear.`);
  }
  if (d.topSenders.length) {
    lines.push("Top senders: " + d.topSenders.map((s) => `${s.name} (${s.count})`).join(", ") + ".");
  }
  return lines.join("\n");
}

// ---- Instant replies / write-with-AI --------------------------------------

function asksForMeeting(text: string): boolean {
  return /\b(call|meet|chat|sync|time|schedule|calendar|invite|1:1|catch up)\b/i.test(text);
}
function asksQuestion(text: string): boolean {
  return /\?/.test(text);
}

export function instantReplies(email: Email, p: Personalization = DEFAULT_PERSONALIZATION): string[] {
  const name = email.from.name.split(" ")[0];
  const text = `${email.subject} ${email.body}`;
  const out: string[] = [];
  // Use the precise, false-positive-guarded scheduling detector (slice 66) so a
  // bare "thanks for the call" doesn't trigger a meeting reply — and let it
  // shape the proposed length ("could we find 15 minutes" for a quick call).
  const meeting = detectMeetingRequest(email);
  if (meeting) {
    out.push(`Sounds good ${name} — could we find ${meeting.durationMinutes} minutes this week?`);
    out.push(`Works for me. Sending a calendar invite shortly.`);
  }
  if (asksQuestion(text)) {
    out.push(`Good question — let me look into it and get back to you today.`);
  }
  // Generic acknowledgements reflect the user's tone.
  if (p.tone === "casual") {
    out.push(`Thanks ${name}! Got it.`);
    out.push(`Appreciate it — I'll follow up soon.`);
  } else if (p.tone === "formal") {
    out.push(`Thank you, ${name}. Noted.`);
    out.push(`I appreciate the note and will follow up shortly.`);
  } else {
    out.push(`Thanks ${name}, got it.`);
    out.push(`Appreciate the note — I'll follow up shortly.`);
  }
  return [...new Set(out)].slice(0, 3);
}

export function draftReply(
  email: Email,
  intent: string,
  p: Personalization = DEFAULT_PERSONALIZATION
): string {
  const name = email.from.name.split(" ")[0];
  const opener = intent
    ? `Re: ${intent.trim()} — here's where I land.`
    : `Thanks for the note on "${email.subject}". Here's where I land.`;
  return composeBody(p, name, [opener]);
}

// Tone-aware lead-in / closing lines so generated mail matches the user's voice.
function leadIn(p: Personalization, clean: string): string {
  if (!clean) {
    return p.tone === "casual" ? "Wanted to reach out quickly." : "Wanted to reach out.";
  }
  const intent = clean.endsWith(".") ? clean : clean + ".";
  if (p.tone === "casual") return `Quick one — ${intent}`;
  if (p.tone === "formal") return `I'm writing regarding ${intent}`;
  return `Wanted to reach out: ${intent}`;
}
function closingLine(p: Personalization): string {
  if (p.tone === "casual") return "Lmk what works!";
  if (p.tone === "formal") return "Please let me know your availability.";
  return "Let me know what works — happy to find time.";
}

// Write a fresh message from a short intent ("ask Dana for the Q3 numbers").
export function writeWithAi(
  intent: string,
  recipient?: string,
  p: Personalization = DEFAULT_PERSONALIZATION
): { subject: string; body: string } {
  const clean = intent.trim();
  const subject = clean
    ? clean[0].toUpperCase() + clean.slice(1).replace(/[.?!]+$/, "")
    : "Quick note";
  const who = recipient ? recipient.split("@")[0].split(/[.\s]/)[0] : "there";
  const who2 = who ? who[0].toUpperCase() + who.slice(1) : "there";
  const paras = [leadIn(p, clean)];
  if (p.verbosity !== "brief") paras.push(closingLine(p));
  if (p.verbosity === "detailed")
    paras.push("Happy to share any context that would help — just say the word.");
  return { subject: subject.slice(0, 120), body: composeBody(p, who2, paras) };
}

// ---- Rewrite / tone-shift (compose helper) --------------------------------
//
// Superhuman AI can rewrite a draft: make it shorter/longer, shift the tone, or
// polish grammar. These are deterministic local transforms so they work offline
// and in tests; a provider key would route to a hosted model for richer results.

export type RewriteMode = "shorter" | "longer" | "formal" | "casual" | "polish";

export const REWRITE_MODES: { mode: RewriteMode; label: string; hint: string }[] = [
  { mode: "shorter", label: "Make shorter", hint: "Trim filler, keep the point" },
  { mode: "longer", label: "Make longer", hint: "Add a courteous close" },
  { mode: "formal", label: "More formal", hint: "Expand contractions, professional tone" },
  { mode: "casual", label: "More casual", hint: "Friendlier, contractions" },
  { mode: "polish", label: "Fix grammar", hint: "Capitalization, spacing, punctuation" },
];

const CONTRACTIONS: [RegExp, string][] = [
  [/\bI'm\b/g, "I am"], [/\bI'll\b/g, "I will"], [/\bI've\b/g, "I have"], [/\bI'd\b/g, "I would"],
  [/\bdon't\b/gi, "do not"], [/\bcan't\b/gi, "cannot"], [/\bwon't\b/gi, "will not"],
  [/\bdoesn't\b/gi, "does not"], [/\bdidn't\b/gi, "did not"], [/\bisn't\b/gi, "is not"],
  [/\baren't\b/gi, "are not"], [/\bwasn't\b/gi, "was not"], [/\bwouldn't\b/gi, "would not"],
  [/\bcouldn't\b/gi, "could not"], [/\bshouldn't\b/gi, "should not"],
  [/\bwe're\b/gi, "we are"], [/\byou're\b/gi, "you are"], [/\bthey're\b/gi, "they are"],
  [/\bit's\b/gi, "it is"], [/\bthat's\b/gi, "that is"], [/\bwhat's\b/gi, "what is"],
  [/\bhere's\b/gi, "here is"], [/\bthere's\b/gi, "there is"], [/\blet's\b/gi, "let us"],
];

const FORMALIZE: [RegExp, string][] = [
  [/\bhey\b/gi, "Hello"], [/\bhi\b/gi, "Hello"], [/\bthanks\b/gi, "Thank you"],
  [/\bthx\b/gi, "Thank you"], [/\byeah\b/gi, "yes"], [/\byep\b/gi, "yes"], [/\bnope\b/gi, "no"],
  [/\bgonna\b/gi, "going to"], [/\bwanna\b/gi, "want to"], [/\bkinda\b/gi, "somewhat"],
  [/\blmk\b/gi, "please let me know"], [/\basap\b/gi, "as soon as possible"],
  [/\bfyi\b/gi, "for your reference"], [/\bcheers\b/gi, "Best regards"],
];

// Filler words/phrases removed when shortening.
const FILLER = /\b(just|really|very|actually|basically|simply|i think that|i think|kind of|sort of|you know|honestly|literally)\b/gi;

function collapseSpaces(s: string): string {
  // Collapse runs of spaces/tabs but preserve newlines and paragraph breaks.
  return s.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

function applyAll(text: string, pairs: [RegExp, string][]): string {
  return pairs.reduce((acc, [re, to]) => acc.replace(re, to), text);
}

// Capitalize the first letter of every sentence and the very start.
function fixCapitalization(text: string): string {
  let out = text.replace(/(^|[.!?]\s+|\n+)([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());
  out = out.replace(/\bi\b/g, "I"); // standalone pronoun
  return out;
}

export function rephrase(text: string, mode: RewriteMode, p: Personalization = DEFAULT_PERSONALIZATION): string {
  const src = text.trim();
  if (!src) return text;
  switch (mode) {
    case "polish": {
      let out = collapseSpaces(src);
      out = fixCapitalization(out);
      // Ensure terminal punctuation on the final non-empty line.
      out = out.replace(/([A-Za-z0-9"'\)])\s*$/, (_m, ch) => `${ch}.`);
      return out;
    }
    case "formal": {
      let out = applyAll(src, CONTRACTIONS);
      out = applyAll(out, FORMALIZE);
      return fixCapitalization(out);
    }
    case "casual": {
      // Reverse a few contractions and warm the opener.
      let out = src
        .replace(/\bI am\b/g, "I'm")
        .replace(/\bdo not\b/gi, "don't")
        .replace(/\bcannot\b/gi, "can't")
        .replace(/\bwill not\b/gi, "won't")
        .replace(/\bit is\b/gi, "it's")
        .replace(/\bwe are\b/gi, "we're")
        .replace(/\bHello\b/g, "Hi")
        .replace(/\bThank you\b/g, "Thanks");
      return out;
    }
    case "shorter": {
      const compact = collapseSpaces(src.replace(FILLER, "").replace(/\s{2,}/g, " "));
      // Keep at most the first two sentences of each paragraph.
      const paras = compact.split(/\n{2,}/).map((para) => {
        const sents = sentences(para);
        return sents.length > 2 ? sents.slice(0, 2).join(" ") : para.trim();
      });
      return paras.join("\n\n").trim();
    }
    case "longer": {
      const close =
        p.tone === "formal"
          ? "Please let me know if any further detail would be helpful."
          : p.tone === "casual"
          ? "Happy to share more if it's useful — just shout."
          : "Happy to add any detail that would help — just let me know.";
      return src.endsWith(close) ? src : `${src}\n\n${close}`;
    }
    default:
      return text;
  }
}

// ---- Auto labels ----------------------------------------------------------

export interface LabelRule {
  label: string;
  test: (e: Email) => boolean;
}

export const AUTO_LABEL_RULES: LabelRule[] = [
  {
    label: "Finance",
    test: (e) =>
      /receipt|invoice|payment|stripe|billing|charged|subscription/i.test(
        `${e.subject} ${e.from.email} ${e.body}`
      ),
  },
  {
    label: "Recruiting",
    test: (e) => /interview|candidate|recruit|hiring|resume|cv\b/i.test(`${e.subject} ${e.body}`),
  },
  {
    label: "Calendar",
    test: (e) =>
      /\b(invite|meeting|1:1|calendar|reschedule)\b/i.test(`${e.subject} ${e.body}`) ||
      /calendar@/i.test(e.from.email),
  },
  {
    label: "Newsletter",
    test: (e) => e.category === "news" || /digest|newsletter|unsubscribe/i.test(e.body),
  },
  {
    label: "Clients",
    test: (e) => /contract|msa|redline|sow|proposal|procurement/i.test(`${e.subject} ${e.body}`),
  },
];

// Suggest labels for one email (does not mutate; the UI applies on accept).
export function suggestLabels(email: Email): string[] {
  return AUTO_LABEL_RULES.filter((r) => r.test(email)).map((r) => r.label);
}

// ---- Auto-organize (bulk auto-label the inbox) ----------------------------

export interface OrganizeChange {
  id: string;
  add: string[]; // labels to add (those not already on the message)
}

export interface OrganizePlan {
  changes: OrganizeChange[];
  totalLabels: number;
  byLabel: Record<string, number>;
}

// Plan a bulk auto-label pass over the live inbox: for each non-archived,
// non-trashed message, the suggested labels it doesn't already have. Pure — the
// UI applies it as a single undoable step.
export function autoOrganizePlan(emails: Email[]): OrganizePlan {
  const changes: OrganizeChange[] = [];
  const byLabel: Record<string, number> = {};
  for (const e of emails) {
    if (e.archived || e.trashed) continue;
    const add = suggestLabels(e).filter((l) => !e.labels.includes(l));
    if (add.length) {
      changes.push({ id: e.id, add });
      for (const l of add) byLabel[l] = (byLabel[l] ?? 0) + 1;
    }
  }
  const totalLabels = changes.reduce((n, c) => n + c.add.length, 0);
  return { changes, totalLabels, byLabel };
}

// Short human summary of an organize plan, e.g. "Finance ×3, Calendar ×2".
export function organizeSummary(plan: OrganizePlan): string {
  return Object.entries(plan.byLabel)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, n]) => `${label} ×${n}`)
    .join(", ");
}

// ---- Auto-archive suggestions ---------------------------------------------

// Heuristic: low-signal bulk mail (news/social, automated senders, no question
// directed at you) is a good archive candidate.
export function shouldSuggestArchive(email: Email): boolean {
  if (email.archived || email.starred) return false;
  const automated = /no-?reply|notifications?@|digest@|info@|hello@|mailer/i.test(email.from.email);
  const lowSignal = email.category === "news" || email.category === "social";
  const directed = asksQuestion(email.body) || asksForMeeting(email.body);
  return (lowSignal || automated) && !directed;
}

export function autoArchiveCandidates(emails: Email[]): Email[] {
  return emails.filter((e) => !e.archived && shouldSuggestArchive(e));
}

// Inbound, unread messages that look like they're waiting on a reply from you
// (a direct question or a meeting ask). Used by Ask-inbox and the stats view.
export function needsReplyCandidates(emails: Email[]): Email[] {
  return emails.filter(
    (e) =>
      !e.archived &&
      !e.trashed &&
      !e.outbound &&
      !e.read &&
      (asksQuestion(e.body) || asksForMeeting(e.body))
  );
}

// ---- Follow-up drafts -----------------------------------------------------

// Draft a gentle nudge for a thread that hasn't gotten a reply.
export function followUpDraft(email: Email, p: Personalization = DEFAULT_PERSONALIZATION): string {
  const name = email.from.name.split(" ")[0];
  return composeBody(p, name, [
    `Floating this back to the top of your inbox — any thoughts on "${email.subject}"?`,
    "No rush at all; just didn't want it to slip.",
  ]);
}

// ---- Ask-inbox (deterministic Q&A over the mailbox) -----------------------

function timeAgo(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  const h = Math.round(diff / 3600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// A small intent router: counts, unread, by-sender, attachments, today, etc.
export function askInbox(emails: Email[], question: string, now: number): AiAnswer {
  const q = question.toLowerCase().trim();
  const live = emails.filter((e) => !e.archived);
  const unread = live.filter((e) => !e.read);

  // "Catch me up" / inbox digest.
  if (/catch me up|brief me|summar(ize|y|ise).*(inbox|mail|day|morning|everything)|what.*(happened|did i miss|missed)|\bdigest\b|tl;?dr/.test(q)) {
    const d = inboxDigest(emails, now);
    const sources = [...d.needsReply, ...d.important].slice(0, 6).map((e) => e.id);
    return { text: formatDigest(d), sources, local: true };
  }

  const match = (e: Email, term: string) =>
    [e.from.name, e.from.email, e.subject, e.body, e.from.company ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(term);

  if (/\bunread\b/.test(q) || /how many.*(new|unread)/.test(q)) {
    const top = unread.slice(0, 5);
    return {
      text:
        `You have ${unread.length} unread message${unread.length === 1 ? "" : "s"}.` +
        (top.length
          ? " Most recent: " + top.map((e) => `“${e.subject}” (${e.from.name})`).join("; ")
          : ""),
      sources: top.map((e) => e.id),
      local: true,
    };
  }

  // "What do I need to do?" — extract the concrete asks (deadlines, explicit
  // requests, direct questions) addressed to you across the inbox. Placed
  // before the needs-reply branch so "to-do" / "action items" / "tasks" route
  // to the richer extractor rather than the unread-asks heuristic.
  if (
    /\baction items?\b|\bto-?dos?\b|\btasks?\b|what (?:do|should) i (?:need|have) to do|what.?s on my plate|what am i (?:supposed|meant) to do/.test(
      q,
    )
  ) {
    const items = extractActionItems(live.filter((e) => !e.trashed));
    if (!items.length) {
      return {
        text: "I couldn't find any clear action items — nothing in the inbox is explicitly asking you to do something right now. ✨",
        sources: [],
        local: true,
      };
    }
    return {
      text:
        `${items.length} action item${items.length === 1 ? "" : "s"} from your inbox:\n` +
        items.map((it) => `• ${it.text} — ${it.from}`).join("\n"),
      sources: [...new Set(items.map((it) => it.msgId))],
      local: true,
    };
  }

  // "What did I promise?" — the inverse of action items: the commitments *you*
  // made in your own outbound mail (the deadlines you set yourself, the
  // follow-ups you owe). Placed before the awaiting / needs-reply branches so
  // "what did I commit to" routes to the promise extractor, not a reply
  // heuristic.
  if (
    /what did i (?:promise|commit|say i'?d|agree to|offer)|\bmy (?:commitments?|promises?)\b|what (?:have|did) i commit|what am i on the hook for|what (?:do|did) i owe\b|did i (?:promise|commit|say i'?d)/.test(
      q,
    )
  ) {
    const items = extractCommitments(live.filter((e) => !e.trashed));
    if (!items.length) {
      return {
        text: "I couldn't find any open commitments — nothing you sent reads as a promise you still owe. ✨",
        sources: [],
        local: true,
      };
    }
    return {
      text:
        `${items.length} commitment${items.length === 1 ? "" : "s"} you made:\n` +
        items
          .map((it) => `• ${it.text} — to ${it.to}${it.hasDeadline ? " ⏰" : ""}`)
          .join("\n"),
      sources: [...new Set(items.map((it) => it.msgId))],
      local: true,
    };
  }

  if (/(needs?|require).*(reply|response)|waiting on me/.test(q)) {
    const needs = live.filter(
      (e) => !e.outbound && (asksQuestion(e.body) || asksForMeeting(e.body)) && !e.read
    );
    return {
      text: needs.length
        ? `${needs.length} message${needs.length === 1 ? "" : "s"} look like they need a reply: ` +
          needs.slice(0, 5).map((e) => `“${e.subject}” (${e.from.name})`).join("; ")
        : "Nothing in the inbox looks like it's waiting on a reply from you. ✨",
      sources: needs.slice(0, 5).map((e) => e.id),
      local: true,
    };
  }

  // "What am I waiting on?" — threads where my message is the latest and there's
  // been no reply yet (distinct from "waiting on me", handled above). Reuses the
  // same thread-grouped logic the digest uses, so the answers never diverge.
  if (/waiting (on|for)|awaiting|heard back|\bchase\b|haven.?t (heard|replied|responded)|who hasn.?t (replied|responded)|owe(s|d)? me/.test(q)) {
    const awaiting = awaitingReplyMessages(emails);
    return {
      text: awaiting.length
        ? `You're awaiting a reply on ${awaiting.length} thread${awaiting.length === 1 ? "" : "s"}: ` +
          awaiting.slice(0, 5).map((e) => `“${e.subject}” (to ${e.to[0]?.name ?? "someone"})`).join("; ")
        : "You're not waiting on anyone right now — every thread you sent has a reply. ✨",
      sources: awaiting.slice(0, 6).map((e) => e.id),
      local: true,
    };
  }

  if (/attachment|file|document|pdf|doc\b/.test(q)) {
    const withFiles = live.filter((e) => e.attachments.length);
    return {
      text: withFiles.length
        ? `${withFiles.length} message${withFiles.length === 1 ? "" : "s"} with attachments: ` +
          withFiles.map((e) => `${e.from.name} — ${e.attachments.join(", ")}`).join("; ")
        : "No messages with attachments in the inbox.",
      sources: withFiles.map((e) => e.id),
      local: true,
    };
  }

  // "What's urgent / needs my attention?" — surfaces the Focus priority engine
  // (slice 38) as a question. Ranks live threads by the same deterministic
  // signals the Focus view uses (unread, ball-in-your-court, direct ask,
  // scheduling request, pinned/starred, recency) and names the top few with
  // *why*. Placed before the "starred" branch so "important" / "priority" get
  // the real ranking instead of a literal starred-only list.
  if (
    /\b(urgent|important|priorit(y|ies)|attention)\b|on fire|needs? (my )?attention|focus on|what should i (focus|prioriti|do first|tackle|look at|handle|work on)|most important|high.?priority|what.?s (hot|pressing|critical)|what matters/.test(
      q,
    )
  ) {
    const ranked = focusThreads(groupThreads(live.filter((e) => !e.trashed)), undefined, now);
    if (!ranked.length) {
      return {
        text: "Nothing urgent right now — nothing in the inbox is crossing the attention threshold. ✨",
        sources: [],
        local: true,
      };
    }
    const top = ranked.slice(0, 5);
    const describe = (t: Thread) => {
      const reasons = threadPriority(t, undefined, now).reasons;
      const who = t.participants[0] ?? t.latest.from.name;
      return `“${t.latest.subject}” (${who}${reasons[0] ? ` — ${reasons[0].toLowerCase()}` : ""})`;
    };
    return {
      text:
        `${ranked.length} thread${ranked.length === 1 ? "" : "s"} need your attention: ` +
        top.map(describe).join("; "),
      sources: top.map((t) => t.latest.id),
      local: true,
    };
  }

  if (/\b(starred|flagged)\b/.test(q)) {
    const starred = live.filter((e) => e.starred);
    return {
      text: starred.length
        ? `Starred: ` + starred.map((e) => `“${e.subject}” (${e.from.name})`).join("; ")
        : "Nothing is starred right now.",
      sources: starred.map((e) => e.id),
      local: true,
    };
  }

  // "Who wants to meet?" / "any scheduling requests?" — inbound messages that
  // read as a meeting ask (slice 66's detector), one per thread, with the why.
  if (/\b(meeting|scheduling) requests?\b|who wants to (meet|talk|chat|connect)|wants? to (meet|schedule)|asking to (meet|schedule|chat)|trying to (schedule|set ?up)|schedule a (call|meeting)|set ?up a (call|meeting)|any (meetings?|scheduling)\b/.test(q)) {
    const byThread = new Map<string, Email>();
    for (const e of live) {
      if (!detectMeetingRequest(e)) continue;
      const cur = byThread.get(e.threadId);
      if (!cur || new Date(e.date).getTime() > new Date(cur.date).getTime()) byThread.set(e.threadId, e);
    }
    const reqs = [...byThread.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return {
      text: reqs.length
        ? `${reqs.length} scheduling request${reqs.length === 1 ? "" : "s"}: ` +
          reqs.slice(0, 5).map((e) => `“${e.subject}” (${e.from.name} — ${meetingReasonText(detectMeetingRequest(e)!)})`).join("; ")
        : "No open scheduling requests — nobody's asking to meet right now. ✨",
      sources: reqs.slice(0, 6).map((e) => e.id),
      local: true,
    };
  }

  if (/\breminders?\b|\bfollow.?ups?\b|what.*\bdue\b|remind me/.test(q)) {
    const withRem = emails.filter((e) => e.reminderAt && !e.trashed);
    if (!withRem.length) {
      return { text: "No reminders or follow-ups are set right now.", sources: [], local: true };
    }
    const at = (e: Email) => new Date(e.reminderAt!).getTime();
    const due = withRem.filter((e) => at(e) <= now).sort((a, b) => at(a) - at(b));
    const upcoming = withRem.filter((e) => at(e) > now).sort((a, b) => at(a) - at(b));
    const fmt = (e: Email) =>
      `“${e.subject}” (${e.from.name})${e.remindIfNoReply ? " — if no reply" : ""}`;
    const parts: string[] = [];
    if (due.length) parts.push(`${due.length} due now: ` + due.slice(0, 5).map(fmt).join("; "));
    if (upcoming.length) parts.push(`${upcoming.length} upcoming, next: ${fmt(upcoming[0])}`);
    return {
      text: `You have ${withRem.length} reminder${withRem.length === 1 ? "" : "s"}. ` + parts.join(". "),
      sources: [...due, ...upcoming].slice(0, 6).map((e) => e.id),
      local: true,
    };
  }

  const fromMatch = q.match(/(?:from|by|about|regarding|re:?)\s+([a-z0-9@.\- ]{2,})/);
  const term = (fromMatch?.[1] ?? q.replace(/[^a-z0-9@.\- ]/g, " ")).trim();
  if (term) {
    const hits = live.filter((e) => match(e, term)).slice(0, 6);
    if (hits.length) {
      return {
        text:
          `Found ${hits.length} message${hits.length === 1 ? "" : "s"} matching “${term}”: ` +
          hits.map((e) => `“${e.subject}” — ${e.from.name} (${timeAgo(e.date, now)})`).join("; "),
        sources: hits.map((e) => e.id),
        local: true,
      };
    }
  }

  return {
    text:
      `I searched the inbox but couldn't find a confident answer to “${question}”. ` +
      `Try asking about what's urgent / needs your attention, what you need to do (your action items), what you promised (your commitments), unread, what needs a reply, what you're waiting on, scheduling requests, your reminders / follow-ups, attachments, or a sender's name.`,
    sources: [],
    local: true,
  };
}

// The async entry point a real provider integration would replace.
export async function aiComplete(cfg: AiConfig, prompt: string): Promise<string> {
  if (!cfg.enabled) {
    return `[local-ai] ${prompt.slice(0, 200)}`;
  }
  // Integration point: route to Anthropic/OpenAI using cfg.apiKey + cfg.model.
  // Intentionally not executed in dev to avoid requiring paid credentials.
  throw new Error(`AI provider "${cfg.provider}" wired but not enabled in dev build`);
}
