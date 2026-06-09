// Tentative calendar "holds" — block a provisional slot straight from a detected
// scheduling request, the way Superhuman lets you grab time the moment someone
// asks to meet (before you've nailed down the exact time with them).
//
// A hold is an ordinary CalendarEvent flagged `tentative` and linked back to the
// conversation it was placed for (`holdThreadId`), so the reader can show "you're
// holding Tue 9:00" and let you release it, and the slot is honored as busy when
// finding the *next* open time (no double-booking your own holds).
//
// Everything here is PURE and DETERMINISTIC — the search start instant (`fromIso`)
// is injected, never read from the clock — so the unit tests are stable on any
// machine. SAFETY: like the rest of calendar.ts this only ever touches the
// in-memory mock; it never writes to a real calendar and never sends mail.

import {
  type AvailabilityQuery,
  type CalendarEvent,
  type TimeSlot,
  findAvailability,
  formatSlot,
} from "./calendar";

const DAY = 86_400_000;

// How far ahead we look for an open slot to hold, by default.
export const HOLD_WINDOW_DAYS = 10;

const MAX_TITLE = 60;

export interface HoldSlotOptions {
  durationMinutes: number;
  fromIso: string; // search from this instant (the caller passes "now")
  days?: number; // window length in days, default HOLD_WINDOW_DAYS
  busy?: TimeSlot[]; // extra busy intervals (e.g. an attendee's calendar)
  workingHoursOnly?: boolean;
  workStartHour?: number;
  workEndHour?: number;
}

// Find the first open working-hours slot to provisionally hold for a meeting,
// honoring existing events (including other holds) so we never double-book.
// Returns null when nothing is free in the window or the inputs are invalid.
export function proposeHoldSlot(events: CalendarEvent[], opts: HoldSlotOptions): TimeSlot | null {
  const from = Date.parse(opts.fromIso);
  if (isNaN(from) || opts.durationMinutes <= 0) return null;
  const days = opts.days ?? HOLD_WINDOW_DAYS;
  const q: AvailabilityQuery = {
    start: opts.fromIso,
    end: new Date(from + days * DAY).toISOString(),
    durationMinutes: opts.durationMinutes,
    maxSlots: 1,
    busy: opts.busy,
    workingHoursOnly: opts.workingHoursOnly,
    workStartHour: opts.workStartHour,
    workEndHour: opts.workEndHour,
  };
  return findAvailability(events, q)[0] ?? null;
}

// Drop a leading "Re:" / "Fwd:" / "Fw:" chain so a held meeting reads cleanly.
function stripReply(subject: string): string {
  let s = (subject || "").trim();
  for (;;) {
    const next = s.replace(/^(re|fwd?|fw)\s*:\s*/i, "");
    if (next === s) break;
    s = next;
  }
  return s.trim();
}

// "Hold: Roadmap sync" — a tidy, capped title derived from the thread subject,
// with a sensible fallback when there's nothing to go on.
export function holdTitle(subject?: string | null): string {
  const base = stripReply(subject || "");
  if (!base) return "Hold: meeting";
  const trimmed = base.length > MAX_TITLE ? `${base.slice(0, MAX_TITLE - 1).trimEnd()}…` : base;
  return `Hold: ${trimmed}`;
}

export interface BuildHoldOptions {
  threadId: string;
  subject?: string | null;
  attendees?: string[];
}

// Build a tentative "hold" event payload from a chosen slot. It's flagged
// tentative (provisional, not a confirmed meeting) and linked to its thread so
// it can be found, summarized and released. Pair with createEvent() to place it.
export function buildHold(slot: TimeSlot, opts: BuildHoldOptions): Omit<CalendarEvent, "id"> {
  return {
    title: holdTitle(opts.subject),
    start: slot.start,
    end: slot.end,
    attendees: opts.attendees && opts.attendees.length ? [...opts.attendees] : undefined,
    conference: true,
    tentative: true,
    holdThreadId: opts.threadId,
    source: "mock",
  };
}

// Is this event a tentative hold (rather than a confirmed meeting)?
export function isHold(e: CalendarEvent): boolean {
  return !!e.tentative;
}

// The tentative hold placed for a given thread, if any (the earliest by start
// when, somehow, more than one exists).
export function findHoldForThread(events: CalendarEvent[], threadId: string): CalendarEvent | undefined {
  return events
    .filter((e) => e.tentative && e.holdThreadId === threadId)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
}

// "Mon, Jun 8 · 9:00–9:30 AM" — a human-readable slot for the banner / toast
// (accepts any {start,end}, so a TimeSlot or a CalendarEvent both work).
export function holdSummary(slot: { start: string; end: string }): string {
  return formatSlot({ start: slot.start, end: slot.end });
}

// A paste-ready reply that proposes one specific held slot — the natural
// follow-up to placing a hold ("I've blocked Tue 9am; does that work?"). The
// caller adds the greeting, mirroring replyWithTimes. tzLabel is appended for
// honesty since the slot is rendered in UTC.
export function heldTimeText(slot: { start: string; end: string }, opts: { tzLabel?: string } = {}): string {
  const tz = opts.tzLabel ? ` (${opts.tzLabel})` : "";
  return (
    `Would ${holdSummary(slot)}${tz} work for you? I've tentatively held it on my end — ` +
    `just let me know and I'll send a calendar invite, or share another time that suits you.`
  );
}
