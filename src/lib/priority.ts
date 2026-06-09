import type { Email } from "../types";
import type { Thread } from "./threads";
import { detectMeetingRequest } from "./meetingIntent";

// Attention ranking — "focus on what matters".
//
// Superhuman's whole pitch is spending less time in your inbox by surfacing what
// needs you. SuperMail adds a deterministic priority score per conversation and a
// Focus view that shows only the attention-worthy threads, ranked. This is
// distinct from Split Inbox (rule-based *categorization*) — it's a content- and
// state-aware *ranking* of what to deal with next.
//
// Pure and deterministic so it unit-tests directly. `vip` is a set of lowercased
// sender emails considered VIPs (frequent / starred correspondents from the
// contact graph); `now` (epoch ms) drives the recency nudge (0 disables it).

export interface PriorityResult {
  score: number; // clamped to >= 0
  reasons: string[]; // positive drivers, strongest first
}

// Asks that imply you owe a reply even without a literal "?".
const ASK_RE =
  /\b(can|could|would|will)\s+you\b|\bplease\b|\blet me know\b|\bany update\b|\bcircle back\b|\bfollow(ing)? up\b|\bwaiting (on|for)\b|\bby (eod|end of day|tomorrow|monday|tuesday|wednesday|thursday|friday)\b/i;

function isBulk(m: Email): boolean {
  return Boolean(m.listUnsubscribe) || m.category === "news" || m.category === "social";
}

function hasAsk(m: Email): boolean {
  const text = `${m.subject}\n${m.body}`;
  return text.includes("?") || ASK_RE.test(text);
}

const DAY = 24 * 3_600_000;

// Score a conversation by how much it needs your attention right now.
export function threadPriority(thread: Thread, vip: Set<string> = new Set(), now = 0): PriorityResult {
  if (thread.muted) return { score: 0, reasons: [] };

  const m = thread.latest;
  const reasons: string[] = [];
  let score = 0;

  if (thread.hasUnread) {
    score += 30;
    reasons.push("Unread");
  }
  if (!m.outbound) {
    // The last word in the thread is theirs — the ball is in your court.
    score += 25;
    reasons.push("Awaiting your reply");
  } else {
    score -= 10; // you already replied last; you're waiting on them
  }
  if (vip.has((m.from.email || "").toLowerCase())) {
    score += 25;
    reasons.push("VIP sender");
  }
  // A scheduling request is a specific, actionable ask — score it a notch above
  // a generic direct ask, and prefer its clearer reason (mutually exclusive so
  // the two asks never double-count).
  if (!m.outbound && detectMeetingRequest(m)) {
    score += 18;
    reasons.push("Scheduling request");
  } else if (!m.outbound && hasAsk(m)) {
    score += 15;
    reasons.push("Direct ask");
  }
  if (thread.pinned) {
    score += 20;
    reasons.push("Pinned");
  }
  if (thread.starred) {
    score += 10;
    reasons.push("Starred");
  }
  if (thread.reminderAt) {
    score += 10;
    reasons.push("Reminder set");
  }
  if (isBulk(m)) {
    score -= 40; // newsletters / list mail are rarely what needs you
  }

  // Recency nudge (only when a clock is provided).
  if (now) {
    const age = now - Date.parse(thread.latestDate);
    if (age >= 0 && age <= DAY) score += 10;
    else if (age <= 3 * DAY) score += 5;
  }

  return { score: Math.max(0, score), reasons };
}

// The threshold above which a conversation lands in Focus. Unread human mail with
// the ball in your court clears it; handled threads and bulk mail don't.
export const FOCUS_THRESHOLD = 40;

export function isAttentionWorthy(thread: Thread, vip?: Set<string>, now = 0): boolean {
  return threadPriority(thread, vip, now).score >= FOCUS_THRESHOLD;
}

// Threads sorted by priority (desc), ties broken by recency (newest first).
export function rankByPriority(threads: Thread[], vip?: Set<string>, now = 0): Thread[] {
  return threads
    .map((t) => ({ t, p: threadPriority(t, vip, now).score }))
    .sort((a, b) => b.p - a.p || Date.parse(b.t.latestDate) - Date.parse(a.t.latestDate))
    .map((x) => x.t);
}

// The Focus list: attention-worthy threads, ranked.
export function focusThreads(threads: Thread[], vip?: Set<string>, now = 0): Thread[] {
  return rankByPriority(
    threads.filter((t) => isAttentionWorthy(t, vip, now)),
    vip,
    now
  );
}
