// Calendar & scheduling engine.
//
// Mirrors Superhuman's calendar surface for a power Gmail user: see your
// upcoming events without leaving the inbox, "Find a time" across a window
// while honoring working hours and existing meetings, "Send availability"
// (turn open slots into a clean text block you can paste into a reply), and
// "hold"/schedule a meeting from a slot.
//
// Everything here is PURE and DETERMINISTIC — no Date.now() inside, no hidden
// timezone surprises. Times are computed and rendered in UTC so unit tests are
// stable on any machine; the UI labels times as UTC for honesty. A real
// integration would honor the user's IANA timezone (see CalendarProvider).
//
// SAFETY: writing to a *live* calendar is intentionally NOT wired, exactly like
// email sending is permanently disabled. Only the in-memory MockCalendarProvider
// creates events. The headline value — computing availability and inserting it
// into a draft for the human to send — never touches a real account.

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  attendees?: string[];
  location?: string;
  conference?: boolean; // has a video link
  allDay?: boolean;
  organizer?: string;
  source?: "mock" | "google";
  tentative?: boolean; // a provisional "hold" rather than a confirmed meeting
  holdThreadId?: string; // the conversation this hold was placed for (see holds.ts)
}

export interface TimeSlot {
  start: string; // ISO
  end: string; // ISO
}

export interface AvailabilityQuery {
  start: string; // ISO — window start
  end: string; // ISO — window end
  durationMinutes: number; // desired meeting length
  workingHoursOnly?: boolean; // default true (skip weekends + off-hours)
  workStartHour?: number; // UTC hour, default 9
  workEndHour?: number; // UTC hour, default 17
  maxSlots?: number; // default 6
  slotStepMinutes?: number; // candidate granularity; default = durationMinutes
  busy?: TimeSlot[]; // extra busy intervals (e.g. other participants)
}

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

interface Interval {
  start: number;
  end: number;
}

// Half-open overlap test: [aStart,aEnd) intersects [bStart,bEnd).
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function startOfUTCDay(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Sort + coalesce overlapping/adjacent busy intervals into a minimal set.
export function mergeBusy(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

function eventBusyInterval(e: CalendarEvent): Interval {
  const s = Date.parse(e.start);
  if (e.allDay) {
    const day = startOfUTCDay(s);
    const endDay = e.end ? startOfUTCDay(Date.parse(e.end)) : day;
    return { start: day, end: endDay + DAY };
  }
  return { start: s, end: Date.parse(e.end) };
}

function busyFrom(events: CalendarEvent[], extra: TimeSlot[] = []): Interval[] {
  return mergeBusy([
    ...events.map(eventBusyInterval),
    ...extra.map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })),
  ]);
}

// Core "Find a time": walk the window day by day, honor working hours + the
// weekend skip, and return open slots of the requested duration that don't
// collide with any event or participant-busy interval.
export function findAvailability(events: CalendarEvent[], q: AvailabilityQuery): TimeSlot[] {
  const duration = q.durationMinutes * MIN;
  if (duration <= 0) return [];
  const step = (q.slotStepMinutes ?? q.durationMinutes) * MIN;
  const workStart = q.workStartHour ?? 9;
  const workEnd = q.workEndHour ?? 17;
  const workingOnly = q.workingHoursOnly ?? true;
  const maxSlots = q.maxSlots ?? 6;
  const windowStart = Date.parse(q.start);
  const windowEnd = Date.parse(q.end);
  if (!(windowEnd > windowStart)) return [];

  const busy = busyFrom(events, q.busy ?? []);
  const slots: TimeSlot[] = [];

  for (let day = startOfUTCDay(windowStart); day <= windowEnd && slots.length < maxSlots; day += DAY) {
    if (workingOnly) {
      const dow = new Date(day).getUTCDay();
      if (dow === 0 || dow === 6) continue; // skip Sat/Sun
    }
    const dayFrom = workingOnly ? day + workStart * HOUR : day;
    const dayTo = workingOnly ? day + workEnd * HOUR : day + DAY;
    const limit = Math.min(dayTo, windowEnd);
    let t = Math.max(dayFrom, windowStart);
    // Align candidate starts to a tidy step grid relative to the day's start.
    if (t > dayFrom) {
      const off = (t - dayFrom) % step;
      if (off !== 0) t += step - off;
    }
    while (t + duration <= limit && slots.length < maxSlots) {
      const conflict = busy.find((b) => overlaps(t, t + duration, b.start, b.end));
      if (conflict) {
        t = conflict.end;
        const off = (t - dayFrom) % step;
        if (off !== 0) t += step - off; // re-align after the conflict
        continue;
      }
      slots.push({ start: new Date(t).toISOString(), end: new Date(t + duration).toISOString() });
      t += step;
    }
  }
  return slots;
}

// Does a proposed slot collide with any event / extra-busy interval?
export function hasConflict(events: CalendarEvent[], slot: TimeSlot, extraBusy: TimeSlot[] = []): boolean {
  const s = Date.parse(slot.start);
  const e = Date.parse(slot.end);
  return busyFrom(events, extraBusy).some((b) => overlaps(s, e, b.start, b.end));
}

// Events that intersect a window, sorted by start.
export function eventsInRange(events: CalendarEvent[], start: string, end: string): CalendarEvent[] {
  const s = Date.parse(start);
  const e = Date.parse(end);
  return events
    .filter((ev) => overlaps(Date.parse(ev.start), Date.parse(ev.end), s, e))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

// Next events that haven't ended yet, soonest first.
export function upcomingEvents(events: CalendarEvent[], now: number, limit = 8): CalendarEvent[] {
  return events
    .filter((e) => Date.parse(e.end) >= now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, limit);
}

// ---- Formatting (deterministic, UTC) --------------------------------------

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function clock(ts: number): { text: string; period: "AM" | "PM" } {
  const d = new Date(ts);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const period = h < 12 ? "AM" : "PM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return { text: `${h12}:${m.toString().padStart(2, "0")}`, period };
}

// A single clock time, e.g. "9:00 AM" (UTC, for deterministic rendering).
export function formatClockTime(iso: string): string {
  const c = clock(Date.parse(iso));
  return `${c.text} ${c.period}`;
}

// "9:00–9:30 AM" (or "11:30 AM – 12:30 PM" across noon)
export function formatTimeRange(slot: TimeSlot): string {
  const a = clock(Date.parse(slot.start));
  const b = clock(Date.parse(slot.end));
  return a.period === b.period
    ? `${a.text}–${b.text} ${b.period}`
    : `${a.text} ${a.period} – ${b.text} ${b.period}`;
}

// "Mon, Jun 8 · 9:00–9:30 AM"
export function formatSlot(slot: TimeSlot): string {
  const s = new Date(Date.parse(slot.start));
  const date = `${WD[s.getUTCDay()]}, ${MO[s.getUTCMonth()]} ${s.getUTCDate()}`;
  return `${date} · ${formatTimeRange(slot)}`;
}

// "Mon, Jun 8 · All day" / "Mon, Jun 8 · 2:00–3:00 PM" for an event row.
export function formatEventWhen(e: CalendarEvent): string {
  if (e.allDay) {
    const s = new Date(Date.parse(e.start));
    return `${WD[s.getUTCDay()]}, ${MO[s.getUTCMonth()]} ${s.getUTCDate()} · All day`;
  }
  return formatSlot({ start: e.start, end: e.end });
}

// Stable per-day grouping key, e.g. "Mon, Jun 8".
export function dayKey(iso: string): string {
  const d = new Date(Date.parse(iso));
  return `${WD[d.getUTCDay()]}, ${MO[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export interface AvailabilityTextOptions {
  tzLabel?: string;
  intro?: string;
  outro?: string;
}

// The "Send availability" block: a clean, paste-ready list of open times.
export function formatAvailabilityText(slots: TimeSlot[], opts: AvailabilityTextOptions = {}): string {
  if (!slots.length) {
    return "I couldn't find an open slot in that window — could you share a few times that work for you?";
  }
  const intro =
    opts.intro ?? `Here are a few times that work for me${opts.tzLabel ? ` (times in ${opts.tzLabel})` : ""}:`;
  const outro = opts.outro ?? "Let me know what works and I'll send a calendar invite.";
  const lines = slots.map((s) => `• ${formatSlot(s)}`);
  return [intro, "", ...lines, "", outro].join("\n");
}

// ---- Event creation (mock / local only) -----------------------------------

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 16) || "event"
  );
}

// Immutably append an event; returns the new list and the created event.
export function createEvent(
  events: CalendarEvent[],
  input: Omit<CalendarEvent, "id"> & { id?: string }
): { events: CalendarEvent[]; event: CalendarEvent } {
  const id = input.id ?? `evt-${events.length + 1}-${slug(input.title)}`;
  const event: CalendarEvent = { source: "mock", ...input, id };
  return { events: [...events, event], event };
}

// Immutably remove an event by id (used to release a tentative hold). A no-op
// returning a fresh array when the id isn't present.
export function removeEvent(events: CalendarEvent[], id: string): CalendarEvent[] {
  return events.filter((e) => e.id !== id);
}

// Build an event payload from a chosen availability slot.
export function eventFromSlot(
  slot: TimeSlot,
  title: string,
  attendees: string[] = []
): Omit<CalendarEvent, "id"> {
  return { title, start: slot.start, end: slot.end, attendees, conference: true, source: "mock" };
}

// ---- Provider (parity with MailProvider) ----------------------------------

export interface CalendarProvider {
  readonly mode: "mock" | "google";
  list(rangeStart: string, rangeEnd: string): Promise<CalendarEvent[]>;
  availability(q: AvailabilityQuery): Promise<TimeSlot[]>;
  // Write path. The mock implements it in-memory; a live provider is
  // intentionally not wired (safety) and would require explicit human opt-in.
  create(input: Omit<CalendarEvent, "id">): Promise<CalendarEvent>;
}

export class MockCalendarProvider implements CalendarProvider {
  readonly mode = "mock" as const;
  private events: CalendarEvent[];

  constructor(seed: CalendarEvent[]) {
    this.events = seed.map((e) => ({ ...e }));
  }

  snapshot(): CalendarEvent[] {
    return this.events.map((e) => ({ ...e }));
  }

  async list(rangeStart: string, rangeEnd: string): Promise<CalendarEvent[]> {
    return eventsInRange(this.events, rangeStart, rangeEnd);
  }

  async availability(q: AvailabilityQuery): Promise<TimeSlot[]> {
    return findAvailability(this.events, q);
  }

  async create(input: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
    const { events, event } = createEvent(this.events, input);
    this.events = events;
    return event;
  }
}

export interface CalendarConfig {
  mode: "mock" | "google";
}

export function loadCalendarConfig(): CalendarConfig {
  const env = import.meta.env;
  const mode = (env.VITE_CALENDAR_MODE ?? "mock").trim() === "google" ? "google" : "mock";
  return { mode };
}

// Factory mirroring createProvider() in provider.ts. Live Google Calendar is a
// documented integration point only: get_availability + create_or_update_event
// map directly to this interface, but writes stay disabled until a human opts in
// for a confirmed account — so we always return the mock provider here.
export function createCalendarProvider(seed: CalendarEvent[]): CalendarProvider {
  return new MockCalendarProvider(seed);
}
