// Natural-language time parsing for Snooze, Remind Me, and Send Later.
//
// Superhuman lets you *type* when you want something back — "tomorrow 9am",
// "next tuesday", "in 3 days", "this evening" — instead of only picking presets.
// This module turns free text into an exact absolute time, and also computes the
// smart presets at real clock times (so "Tomorrow" is actually tomorrow at 8am,
// not the old `now + 24h` approximation).
//
// Determinism / timezones:
//  - Pure offsets ("in 2 hours") are timezone-independent (now + N·unit).
//  - Clock-anchored phrases ("tomorrow 9am", "monday") resolve in the *local*
//    timezone — what the user actually means by "9am".
//  - Everything is anchored to an injected `now` (ms epoch) so it is testable.

export interface ParsedTime {
  at: Date;
  // Normalized, human label, e.g. "Tomorrow at 8:00 AM".
  label: string;
}

// Default local clock times for fuzzy day-parts.
export const DAY_PARTS: Record<string, [number, number]> = {
  morning: [8, 0],
  noon: [12, 0],
  afternoon: [13, 0],
  evening: [18, 0],
  tonight: [20, 0],
  night: [20, 0],
  midnight: [0, 0],
};

// Default morning hour used when a day is named without a time.
export const DEFAULT_MORNING: [number, number] = [8, 0];

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Weekday name → 0..6 (Sun..Sat), including common abbreviations.
const WEEKDAY_INDEX: Record<string, number> = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tues: 2,
  tuesday: 2,
  wed: 3,
  weds: 3,
  wednesday: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

// ---- low-level helpers ----

// A Date at `dayOffset` days from `now`, set to the given local clock time.
function atClock(now: number, [h, m]: [number, number], dayOffset: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

// Push a time to the next day if it is not strictly in the future.
function bumpFuture(d: Date, now: number): Date {
  if (d.getTime() > now) return d;
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return next;
}

// The next occurrence of weekday `dow` (0..6) at `time`. If `forceNext`, always
// land in the following calendar week (used by "next week").
export function nextWeekday(
  now: number,
  dow: number,
  time: [number, number],
  forceNext = false
): Date {
  const cur = new Date(now).getDay();
  let delta = (dow - cur + 7) % 7;
  if (forceNext && delta === 0) delta = 7;
  let d = atClock(now, time, delta);
  if (d.getTime() <= now) d = atClock(now, time, delta + 7);
  return d;
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Calendar-day difference (local), e.g. tomorrow → 1.
function dayDiff(now: number, at: Date): number {
  return Math.round((startOfDay(at.getTime()) - startOfDay(now)) / DAY);
}

// Strip leading connectors so "at 9am" / "@5pm" / "by noon" parse as the time.
function stripAt(s: string): string {
  return s.replace(/^(at|by|@|on)\s*/, "").trim();
}

// Parse a clock fragment → [hours, minutes] (24h), or null.
export function parseClock(input: string): [number, number] | null {
  const t = input.trim().toLowerCase();
  if (!t) return null;
  if (t in DAY_PARTS) return DAY_PARTS[t];
  // 12-hour with am/pm: "9am", "9:30 am", "12pm"
  let m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    if (h < 1 || h > 12 || min > 59) return null;
    if (m[3] === "p" && h !== 12) h += 12;
    if (m[3] === "a" && h === 12) h = 0;
    return [h, min];
  }
  // 24-hour "HH:MM"
  m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h > 23 || min > 59) return null;
    return [h, min];
  }
  // bare hour 0..23
  m = t.match(/^(\d{1,2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    if (h > 23) return null;
    return [h, 0];
  }
  return null;
}

// ---- formatting ----

export function formatTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? "AM" : "PM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

// Human label for an absolute time relative to `now`.
export function formatWhen(at: Date, now: number): string {
  const days = dayDiff(now, at);
  const time = formatTime(at);
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Tomorrow at ${time}`;
  if (days === -1) return `Yesterday at ${time}`;
  if (days > 1 && days < 7) return `${WEEKDAY_LABEL[at.getDay()]} at ${time}`;
  return `${MONTHS[at.getMonth()]} ${at.getDate()} at ${time}`;
}

const make = (at: Date, now: number): ParsedTime => ({ at, label: formatWhen(at, now) });

// ---- offset parsing ("in 2 hours", "30m", "in 3 days at 9am") ----

function parseOffset(s: string, now: number): ParsedTime | null {
  // Months (variable length → calendar arithmetic).
  let m = s.match(/^(?:in\s+)?(\d+)\s*(?:months?|mos?)(?:\s+from now)?$/);
  if (m) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + parseInt(m[1], 10));
    return make(d, now);
  }
  if (/^(?:in\s+)?(?:a|an)\s+month$/.test(s)) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    return make(d, now);
  }
  // Minutes / hours (no clock anchoring possible).
  m = s.match(
    /^(?:in\s+)?(a|an|\d+)\s*(min|mins|minute|minutes|m|hour|hours|hr|hrs|h)(?:\s+from now)?$/
  );
  if (m) {
    const n = m[1] === "a" || m[1] === "an" ? 1 : parseInt(m[1], 10);
    const unit = m[2][0] === "m" ? MINUTE : HOUR;
    return make(new Date(now + n * unit), now);
  }
  // Days / weeks, with an optional trailing time ("in 3 days at 9am").
  m = s.match(
    /^(?:in\s+)?(a|an|\d+)\s*(day|days|d|week|weeks|wk|wks|w)(?:\s+(?:at\s+|@\s*|on\s+)?(.+))?$/
  );
  if (m) {
    const n = m[1] === "a" || m[1] === "an" ? 1 : parseInt(m[1], 10);
    const isWeek = /^w/.test(m[2]);
    const dayOffset = isWeek ? n * 7 : n;
    if (m[3]) {
      const clock = parseClock(stripAt(m[3]));
      if (!clock) return null;
      return make(atClock(now, clock, dayOffset), now);
    }
    return make(new Date(now + dayOffset * DAY), now);
  }
  return null;
}

// ---- day-anchor parsing ----

function parseDayAnchor(s: string, now: number): ParsedTime | null {
  // tonight / this evening
  if (/^(tonight|this (evening|eve))$/.test(s)) {
    const part = s === "tonight" ? DAY_PARTS.tonight : DAY_PARTS.evening;
    return make(bumpFuture(atClock(now, part, 0), now), now);
  }

  // end of day / end of week
  if (/^(eod|end of (the )?day)$/.test(s)) {
    return make(bumpFuture(atClock(now, [17, 0], 0), now), now);
  }
  if (/^(eow|end of (the )?week)$/.test(s)) {
    return make(nextWeekday(now, 5, [17, 0]), now); // Friday 5pm
  }

  // weekend
  if (/^(this )?weekend$/.test(s)) {
    return make(nextWeekday(now, 6, DEFAULT_MORNING), now); // Saturday morning
  }
  if (/^next weekend$/.test(s)) {
    return make(nextWeekday(now, 6, DEFAULT_MORNING, true), now);
  }

  // next week / next month
  if (/^next week$/.test(s)) {
    return make(nextWeekday(now, 1, DEFAULT_MORNING, true), now); // next Monday
  }
  if (/^next month$/.test(s)) {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 1);
    d.setHours(DEFAULT_MORNING[0], DEFAULT_MORNING[1], 0, 0);
    return make(d, now);
  }

  // today [at <time>] / this <part>
  let m = s.match(/^(?:today|this)(?:\s+(?:at\s+|@\s*)?(.+))?$/);
  if (m) {
    if (!m[1]) {
      // bare "today" → end of day
      return make(bumpFuture(atClock(now, [17, 0], 0), now), now);
    }
    const clock = parseClock(stripAt(m[1]));
    if (!clock) return null;
    return make(bumpFuture(atClock(now, clock, 0), now), now);
  }

  // tomorrow [<part>|at <time>]
  m = s.match(/^(?:tomorrow|tmrw|tmr|tom)(?:\s+(?:at\s+|@\s*)?(.+))?$/);
  if (m) {
    const clock = m[1] ? parseClock(stripAt(m[1])) : DEFAULT_MORNING;
    if (!clock) return null;
    return make(atClock(now, clock, 1), now);
  }

  // [next] <weekday> [<part>|at <time>]
  m = s.match(/^(next\s+)?([a-z]+?)(?:\s+(?:at\s+|@\s*)?(.+))?$/);
  if (m && m[2] in WEEKDAY_INDEX) {
    const dow = WEEKDAY_INDEX[m[2]];
    const clock = m[3] ? parseClock(stripAt(m[3])) : DEFAULT_MORNING;
    if (!clock) return null;
    return make(nextWeekday(now, dow, clock, false), now);
  }

  return null;
}

// ---- main entry point ----

export function parseNaturalTime(input: string, now: number): ParsedTime | null {
  const raw = (input || "").trim().toLowerCase();
  if (!raw) return null;
  // Strip conversational lead-ins.
  const s = raw
    .replace(/^(remind me|snooze( me)?|send( it)?|wake me|come back|bring back)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;

  return (
    parseOffset(s, now) ??
    parseDayAnchor(s, now) ??
    timeOnly(s, now)
  );
}

// Bare time ("9am", "17:00", "noon") → today if future, else tomorrow.
function timeOnly(s: string, now: number): ParsedTime | null {
  const clock = parseClock(stripAt(s));
  if (!clock) return null;
  return make(bumpFuture(atClock(now, clock, 0), now), now);
}

// ---- smart presets (exact clock times) ----

export interface TimePreset {
  id: string;
  label: string;
  resolve: (now: number) => Date;
}

// Render a preset's resolved time as a subtitle, e.g. "Mon, 8:00 AM".
export function presetSubtitle(p: TimePreset, now: number): string {
  return formatWhen(p.resolve(now), now);
}

export const SNOOZE_SMART_PRESETS: TimePreset[] = [
  { id: "later", label: "Later today", resolve: (n) => new Date(n + 3 * HOUR) },
  { id: "evening", label: "This evening", resolve: (n) => bumpFuture(atClock(n, DAY_PARTS.evening, 0), n) },
  { id: "tomorrow", label: "Tomorrow", resolve: (n) => atClock(n, DEFAULT_MORNING, 1) },
  { id: "weekend", label: "This weekend", resolve: (n) => nextWeekday(n, 6, DEFAULT_MORNING) },
  { id: "nextweek", label: "Next week", resolve: (n) => nextWeekday(n, 1, DEFAULT_MORNING, true) },
];

export const REMIND_SMART_PRESETS: TimePreset[] = [
  { id: "2h", label: "In 2 hours", resolve: (n) => new Date(n + 2 * HOUR) },
  { id: "evening", label: "This evening", resolve: (n) => bumpFuture(atClock(n, DAY_PARTS.evening, 0), n) },
  { id: "tomorrow", label: "Tomorrow morning", resolve: (n) => atClock(n, DEFAULT_MORNING, 1) },
  { id: "2d", label: "In 2 days", resolve: (n) => atClock(n, DEFAULT_MORNING, 2) },
  { id: "nextweek", label: "Next week", resolve: (n) => nextWeekday(n, 1, DEFAULT_MORNING, true) },
];

export const SEND_LATER_SMART_PRESETS: TimePreset[] = [
  { id: "30m", label: "In 30 minutes", resolve: (n) => new Date(n + 30 * MINUTE) },
  { id: "1h", label: "In 1 hour", resolve: (n) => new Date(n + HOUR) },
  { id: "evening", label: "This evening", resolve: (n) => bumpFuture(atClock(n, DAY_PARTS.evening, 0), n) },
  { id: "tomorrow", label: "Tomorrow morning", resolve: (n) => atClock(n, DEFAULT_MORNING, 1) },
  { id: "monday", label: "Monday morning", resolve: (n) => nextWeekday(n, 1, DEFAULT_MORNING, true) },
];
