// Meeting-request detection — recognize when an incoming message is asking to
// schedule time, so the reader can offer a one-click "Reply with my
// availability" (Superhuman's AI surfaces scheduling intent the same way).
//
// This is deliberately conservative: a casual "the meeting went well" or "feel
// free to ignore" must NOT trip it. We scan only the *fresh* text the sender
// wrote (subject + the un-quoted body via splitQuoted), match a curated set of
// scheduling phrases, and guard the ambiguous ones. Pure + fully unit-tested.

import type { Email } from "../types";
import { splitQuoted } from "./quotedText";

export interface MeetingIntent {
  matched: boolean;
  // Up to two short, human-readable reasons ("asks for your availability").
  reasons: string[];
  // Best-guess meeting length in minutes (default 30), inferred from phrases
  // like "quick call" (15), "half an hour" (30) or "an hour" (60).
  durationMinutes: number;
}

interface Signal {
  re: RegExp;
  reason: string;
}

// Ordered most-specific first; reasons are de-duplicated and capped at two so
// the banner stays terse. Each regex targets an *intent to schedule*, not a
// bare noun ("meeting notes", "on our last call") — the verbs/questions are
// what disambiguate a request from a mention.
const SIGNALS: Signal[] = [
  { re: /\bwhen (are|r) (you|u) (free|available)\b/, reason: "asks when you're free" },
  { re: /\b(are|r) (you|u) (free|available)\b/, reason: "asks if you're free" },
  { re: /\b(do|did) (you|u) have (any |some )?(time|availability)\b/, reason: "asks for your time" },
  { re: /\b(your|some|share your|send (me )?your) availability\b/, reason: "asks for your availability" },
  { re: /\bwhen works (for you|best)\b/, reason: "asks when works for you" },
  { re: /\bwhat (time|times|day|days)s? works?\b/, reason: "asks what time works" },
  { re: /\b(let'?s|lets|could we|can we|shall we|want to|wanna|would like to|i'?d like to|happy to|love to) (meet|catch ?up|connect|chat|talk|sync|jump on|hop on)\b/, reason: "suggests meeting" },
  { re: /\b(schedule|set ?up|book|find|grab|arrange|organi[sz]e|pencil in|put) (a |some |an )?(call|meeting|time|slot|chat|sync|coffee|lunch|invite)\b/, reason: "suggests scheduling" },
  { re: /\b(hop|jump|get) on (a )?(quick )?(call|chat|zoom|video)\b/, reason: "suggests a call" },
  // "quick call?" is a common scheduling ask — but guard it so a *past* "thanks
  // for the quick call" stays silent: only fire when a question mark or a
  // forward-looking time word follows soon after.
  { re: /\bquick (call|chat|sync|catch ?up|zoom|hello|one)\b(?=[^.!?\n]{0,40}(\?|this week|next week|tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|soon|sometime|to (discuss|chat|connect|talk|meet)))/, reason: "suggests a quick call" },
  { re: /\b(touch base|sync up)\b/, reason: "wants to sync" },
  { re: /\bgrab (a )?(coffee|lunch|drink|bite)\b/, reason: "suggests meeting up" },
  { re: /\bcalend(ly|ar (invite|link|hold))\b/, reason: "mentions a calendar invite" },
  { re: /\b(book|grab|find|pick) a (time|slot)\b/, reason: "asks to book a time" },
];

const DURATION_SIGNALS: { re: RegExp; minutes: number }[] = [
  { re: /\b(15|fifteen) ?(-| )?min(ute)?s?\b|\bquarter (of an )?hour\b/, minutes: 15 },
  { re: /\b(20|twenty) ?(-| )?min(ute)?s?\b/, minutes: 20 },
  { re: /\b(45|forty.?five) ?(-| )?min(ute)?s?\b/, minutes: 45 },
  // Half-hour must be tested before the generic hour rule so "half an hour"
  // doesn't get swallowed by the "an hour" match.
  { re: /\b(30|thirty) ?(-| )?min(ute)?s?\b|\bhalf (an )?hour\b/, minutes: 30 },
  { re: /\b(an?|one|1|60|sixty) ?(-| )?(hour|hr)s?\b|\bhour.?long\b/, minutes: 60 },
  // "quick" anything reads as a short touch-base.
  { re: /\bquick (call|chat|sync|catch ?up|one)\b/, minutes: 15 },
];

const DEFAULT_DURATION = 30;

export function inferDurationMinutes(text: string): number {
  for (const d of DURATION_SIGNALS) {
    if (d.re.test(text)) return d.minutes;
  }
  return DEFAULT_DURATION;
}

// The text we actually scan: subject + the sender's fresh (un-quoted) words,
// lower-cased. Scanning past the quoted trail would let an old "let's meet"
// buried in history trip every reply forever.
export function meetingScanText(email: Email): string {
  const visible = splitQuoted(email.body || "").visible;
  return `${email.subject || ""}\n${visible}`.toLowerCase();
}

// Detect a scheduling request in a single inbound message. Returns null for an
// outbound message (we only offer availability when *they* ask us) or when no
// signal fires.
export function detectMeetingRequest(email: Email | null | undefined): MeetingIntent | null {
  if (!email || email.outbound) return null;
  const text = meetingScanText(email);
  if (!text.trim()) return null;
  const reasons: string[] = [];
  for (const sig of SIGNALS) {
    if (reasons.length >= 2) break;
    if (sig.re.test(text) && !reasons.includes(sig.reason)) reasons.push(sig.reason);
  }
  if (reasons.length === 0) return null;
  return { matched: true, reasons, durationMinutes: inferDurationMinutes(text) };
}

// Across an open conversation, find the latest inbound message that reads as a
// meeting request (so the reader banner reflects the most recent ask). Returns
// null when nothing in the thread is a scheduling request.
export function meetingRequestInThread(messages: Email[]): { message: Email; intent: MeetingIntent } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const intent = detectMeetingRequest(messages[i]);
    if (intent) return { message: messages[i], intent };
  }
  return null;
}

// A terse summary for the banner, e.g. "asks for your availability · suggests a call".
export function meetingReasonText(intent: MeetingIntent): string {
  return intent.reasons.join(" · ");
}
