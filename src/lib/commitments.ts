import type { Email } from "../types";
import { splitQuoted } from "./quotedText";

// Commitment extraction — the mirror image of action items (slice 74). Where
// action items surface what *others* are asking of you, commitments surface the
// promises *you* made in your own outbound mail ("I'll send the deck by
// Friday", "let me get back to you", "we'll spin up a sandbox"), so you never
// drop the ball on something you said you'd do. We scan only your fresh
// (un-quoted) outbound text, keep sentences that read as a first-person future
// promise, and flag the ones that named a time-bound. Conservative +
// false-positive-guarded: a question ("shall I send it?"), a negation ("I won't
// be able to…"), an ask back to them ("let me know…"), and any inbound message
// never trip it. Pure over the conversation — no provider call.

export interface Commitment {
  // Stable within a render: source message id + sentence index.
  id: string;
  msgId: string;
  threadId: string;
  to: string; // who you promised (recipient display name)
  text: string; // the cleaned sentence
  hasDeadline: boolean; // did the promise name a time-bound?
}

const MAX_ITEMS = 6;
const MAX_LEN = 220;
const MIN_LEN = 8;

// First-person future promises. Each stem is a fairly unambiguous "I/we will do
// X" — a bare "I think" / "I saw" never matches. ("let me" is handled
// separately so we can exclude the ask-back "let me know".)
const COMMIT_LEAD_RE: RegExp[] = [
  /\bi'?ll\b/,
  /\bi will\b/,
  /\bi shall\b/,
  /\bi'?m going to\b/,
  /\bi am going to\b/,
  /\bi'?m planning to\b/,
  /\bi plan to\b/,
  /\bi intend to\b/,
  /\bi promise\b/,
  /\bi can have\b/,
  /\bwe'?ll\b/,
  /\bwe will\b/,
  /\bwe'?re going to\b/,
  /\bwe are going to\b/,
];

// Negated / can't-do statements — "I won't be able to make it", "I'm not going
// to get to it" — are the opposite of a commitment.
const NEGATION_RE =
  /\bwon'?t\b|\bwill not\b|\bcan'?t\b|\bcannot\b|\bnot (?:be able|going to|able to|sure)\b|\bno longer\b|\bunable\b|\bnever\b/;

// Concrete time-bounds a promise might name. Only ever toggles the `hasDeadline`
// flag on a sentence already confirmed as a commitment, so a slightly loose
// match is harmless.
const DEADLINE_RE: RegExp[] = [
  /\bby (?:end of |the end of )?(?:today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|noon|midnight|eod|eow|cob|next week|this week|the weekend|the morning|the afternoon|then)\b/,
  /\bby \d{1,2}(?::\d{2})?\s*(?:am|pm)\b/,
  /\bby (?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/,
  /\b(?:end of (?:day|week|today|the day|the week)|eod|eow|cob)\b/,
  /\bbefore (?:eod|cob|the end of|end of|tomorrow|today|tonight|noon|midnight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week)\b/,
  /\b(?:today|tonight|tomorrow|this (?:afternoon|morning|evening|week)|next week|this weekend|first thing|shortly|right away|asap|as soon as possible)\b/,
  /\bin (?:a (?:few|couple(?: of)?|day|week)|\d+) (?:minutes?|hours?|days?|weeks?)\b/,
  /\bno later than\b/,
  /\bdeadline\b/,
];

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Split into candidate sentences — on line breaks *and* sentence terminators,
// keeping the terminator so a question (?) stays distinguishable from a promise.
function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const noBullet = trimmed.replace(/^[-*•·]\s+/, "").replace(/^\d+[.)]\s+/, "");
    const parts = noBullet.match(/[^.!?]+[.!?]*/g) ?? [noBullet];
    for (const p of parts) {
      const c = clean(p);
      if (c) out.push(c);
    }
  }
  return out;
}

function matchesAny(res: RegExp[], s: string): boolean {
  return res.some((re) => re.test(s));
}

function isCommitment(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  // A firm commitment is a statement, not a question ("Shall I send it over?").
  if (/\?\s*$/.test(sentence)) return false;
  if (NEGATION_RE.test(lower)) return false;
  // "let me check / dig in / get back to you" is a promise; "let me know" is an
  // ask directed back at them.
  const hasLet = /\blet me\b/.test(lower) && !/\blet me know\b/.test(lower);
  return hasLet || matchesAny(COMMIT_LEAD_RE, lower);
}

// Extract the promises you made across one conversation (or any set of messages
// — the AI "what did I promise?" intent passes the whole inbox). Outbound only
// (your own sent mail), freshest message first, deduped, capped.
export function extractCommitments(messages: Email[], selfEmail?: string): Commitment[] {
  const self = (selfEmail ?? "").toLowerCase();
  const ordered = [...messages]
    .filter(
      (m) => !m.trashed && (m.outbound === true || m.from.email.toLowerCase() === self),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const items: Commitment[] = [];
  const seen = new Set<string>();

  for (const m of ordered) {
    if (items.length >= MAX_ITEMS) break;
    const fresh = splitQuoted(m.body).visible || m.body;
    const to = m.to[0]?.name || m.to[0]?.email || "them";
    splitSentences(fresh).forEach((sentence, i) => {
      if (items.length >= MAX_ITEMS) return;
      if (sentence.length < MIN_LEN) return;
      if (!isCommitment(sentence)) return;
      const text =
        sentence.length > MAX_LEN ? sentence.slice(0, MAX_LEN - 1).trimEnd() + "…" : sentence;
      const key = text.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!key || seen.has(key)) return;
      seen.add(key);
      items.push({
        id: `${m.id}:${i}`,
        msgId: m.id,
        threadId: m.threadId,
        to,
        text,
        hasDeadline: matchesAny(DEADLINE_RE, sentence.toLowerCase()),
      });
    });
  }
  return items;
}

// One-line-per-item rendering for the Ask-inbox answer.
export function commitmentsSummary(items: Commitment[]): string {
  return items.map((it) => `• ${it.text} (to ${it.to})`).join("\n");
}
