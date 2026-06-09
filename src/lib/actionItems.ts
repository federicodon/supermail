import type { Email } from "../types";
import { splitQuoted } from "./quotedText";

// Action-item extraction — a deterministic local stand-in for Superhuman's AI
// "what is this email asking me to do?" surface. We scan only what the sender
// wrote *this time* (the fresh, un-quoted text) for sentences that read as an
// ask directed at the reader: a concrete deadline, an explicit request, or a
// real question. Conservative + false-positive-guarded — a pleasantry
// ("how are you?"), a causal "due to", or our own outbound message never trips
// it. No provider call; pure over the conversation.

export type ActionKind = "deadline" | "question" | "request";

export interface ActionItem {
  // Stable within a render: source message id + sentence index.
  id: string;
  msgId: string;
  threadId: string;
  from: string; // sender display name (who is asking)
  text: string; // the cleaned sentence
  kind: ActionKind;
}

const MAX_ITEMS = 6;
const MAX_LEN = 220;
const MIN_LEN = 8;

// Explicit asks directed at the reader. Curated so a bare mention ("on the
// call we…") never matches — each pattern is a fairly unambiguous request.
const REQUEST_RE: RegExp[] = [
  /\bcan you\b/,
  /\bcould you\b/,
  /\bwould you\b/,
  /\bwill you\b/,
  /\bi(?:'d| would)? (?:need|like) you to\b/,
  /\bwe(?:'d| would)? (?:need|like) you to\b/,
  /\bneed you to\b/,
  /\bplease (?:send|review|confirm|sign|share|provide|complete|fill|update|approve|check|forward|reply|respond|advise|let me know|take a look|look (?:at|over)|send over|get back|prepare|schedule|book|add|remove|fix|finalize|finalise|circulate|loop)/,
  /\blet me know\b/,
  /\bmake sure (?:to|you|that)\b/,
  /\bdon'?t forget\b/,
  /\bremember to\b/,
  /\bwhen you (?:get|have) a (?:chance|sec|second|moment|minute)\b/,
  /\bget back to me\b/,
  /\bsend (?:me|us|over|through)\b/,
  /\baction (?:item|items|required|needed)\b/,
];

// Concrete time-bounds. Guarded against the causal "due to …" (not a date) by
// requiring a real time word right after "due".
const DEADLINE_RE: RegExp[] = [
  /\bby (?:end of |the end of )?(?:today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|noon|midnight|eod|eow|cob|next week|this week|the weekend|the morning|the afternoon)\b/,
  /\bby \d{1,2}(?::\d{2})?\s*(?:am|pm)\b/,
  /\bby (?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/,
  /\bdue (?:by|on|date|today|tonight|tomorrow|this|next|eod|cob|friday|monday|tuesday|wednesday|thursday|saturday|sunday)\b/,
  /\bdeadline\b/,
  /\bno later than\b/,
  /\bbefore (?:eod|cob|the end of|end of|tomorrow|today|tonight|noon|midnight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next week|this week)\b/,
  /\bas soon as possible\b/,
  /\basap\b/,
];

// Pleasantries / rhetorical questions that aren't real asks.
const RHETORICAL_RE =
  /^(?:how are you|how are things|how'?s it going|how have you been|hope you'?re well|sound good|sounds good|make sense|does that (?:make sense|work)|right|you know|ok|okay|cool|thoughts|wdyt|no)\b/;

// A question that opens with an interrogative / auxiliary is plausibly aimed at you.
const QUESTION_LEAD_RE =
  /^(?:can|could|would|will|are|is|do|does|did|have|has|had|when|what|where|how|why|which|who|whom|should|shall|may|might)\b/;

// Explicitly-negated asks — the common "FYI, no action needed" / "no reply
// required" footer must never read as a to-do (it says the opposite).
const NON_ASK_RE =
  /\bno (?:action|reply|response|further action) (?:is )?(?:needed|required|necessary|expected)\b|\bnothing (?:is )?(?:needed|required)\b/;

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

// Split into candidate sentences — on line breaks *and* sentence terminators,
// keeping the terminator so a question (?) is distinguishable from a statement.
function splitSentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Drop a leading list bullet / numbering so "- please send X" reads cleanly.
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

function classify(sentence: string): ActionKind | null {
  const lower = sentence.toLowerCase();
  if (NON_ASK_RE.test(lower)) return null;
  const hasDeadline = matchesAny(DEADLINE_RE, lower);
  const isRequest = matchesAny(REQUEST_RE, lower);
  let isQuestion = false;
  if (/\?\s*$/.test(sentence) && !RHETORICAL_RE.test(lower)) {
    isQuestion = /\byou(?:r|rs)?\b/.test(lower) || QUESTION_LEAD_RE.test(lower);
  }
  if (!hasDeadline && !isRequest && !isQuestion) return null;
  // Precedence: a deadline is the most time-critical framing, then an explicit
  // request, then a plain question.
  if (hasDeadline) return "deadline";
  if (isRequest) return "request";
  return "question";
}

// Extract the asks across one conversation (or any set of messages — the AI
// "what do I need to do?" intent passes the whole inbox). Inbound only, freshest
// message first, deduped, capped.
export function extractActionItems(messages: Email[], selfEmail?: string): ActionItem[] {
  const self = (selfEmail ?? "").toLowerCase();
  const ordered = [...messages]
    .filter((m) => !m.outbound && !m.trashed && m.from.email.toLowerCase() !== self)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const items: ActionItem[] = [];
  const seen = new Set<string>();

  for (const m of ordered) {
    if (items.length >= MAX_ITEMS) break;
    const fresh = splitQuoted(m.body).visible || m.body;
    splitSentences(fresh).forEach((sentence, i) => {
      if (items.length >= MAX_ITEMS) return;
      if (sentence.length < MIN_LEN) return;
      const kind = classify(sentence);
      if (!kind) return;
      const text =
        sentence.length > MAX_LEN ? sentence.slice(0, MAX_LEN - 1).trimEnd() + "…" : sentence;
      const key = text.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!key || seen.has(key)) return;
      seen.add(key);
      items.push({
        id: `${m.id}:${i}`,
        msgId: m.id,
        threadId: m.threadId,
        from: m.from.name || m.from.email,
        text,
        kind,
      });
    });
  }
  return items;
}

export function actionKindMeta(kind: ActionKind): { icon: string; label: string } {
  switch (kind) {
    case "deadline":
      return { icon: "⏰", label: "Deadline" };
    case "question":
      return { icon: "❓", label: "Question" };
    case "request":
      return { icon: "✅", label: "Request" };
  }
}

// One-line-per-item rendering for the Ask-inbox answer.
export function actionItemsSummary(items: ActionItem[]): string {
  return items.map((it) => `• ${it.text} (${it.from})`).join("\n");
}
