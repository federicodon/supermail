import { describe, it, expect } from "vitest";
import {
  type CalendarEvent,
  createEvent,
  eventFromSlot,
  eventsInRange,
  findAvailability,
  formatAvailabilityText,
  formatSlot,
  hasConflict,
  MockCalendarProvider,
  mergeBusy,
  overlaps,
  removeEvent,
  upcomingEvents,
} from "./calendar";

// Fixed reference week. 2026-06-08 is a Monday (verified), so weekday/weekend
// assertions are stable on any machine because everything is computed in UTC.
const MON_7AM = "2026-06-08T07:00:00.000Z"; // before the 9:00 work window
const FRI_END = "2026-06-12T23:59:59.000Z";

const ev = (id: string, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  title: id,
  start,
  end,
  source: "mock",
  ...extra,
});

describe("calendar — overlaps & mergeBusy", () => {
  it("overlaps is a half-open intersection", () => {
    expect(overlaps(0, 10, 5, 15)).toBe(true);
    expect(overlaps(0, 10, 10, 20)).toBe(false); // touching, not overlapping
    expect(overlaps(0, 10, -5, 0)).toBe(false);
  });

  it("mergeBusy coalesces overlapping and adjacent intervals", () => {
    const merged = mergeBusy([
      { start: 0, end: 10 },
      { start: 10, end: 20 }, // adjacent
      { start: 5, end: 8 }, // contained
      { start: 30, end: 40 }, // separate
    ]);
    expect(merged).toEqual([
      { start: 0, end: 20 },
      { start: 30, end: 40 },
    ]);
  });
});

describe("calendar — findAvailability", () => {
  it("returns tidy working-hours slots starting at 9:00", () => {
    const slots = findAvailability([], {
      start: MON_7AM,
      end: FRI_END,
      durationMinutes: 30,
    });
    expect(slots.length).toBe(6); // default maxSlots
    expect(slots[0]).toEqual({
      start: "2026-06-08T09:00:00.000Z",
      end: "2026-06-08T09:30:00.000Z",
    });
  });

  it("never proposes a weekend slot", () => {
    const slots = findAvailability([], {
      start: "2026-06-12T15:00:00.000Z", // Friday afternoon
      end: "2026-06-16T12:00:00.000Z", // through Tuesday — window spans a weekend
      durationMinutes: 60,
      maxSlots: 20,
    });
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      const dow = new Date(s.start).getUTCDay();
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
    }
  });

  it("skips over a conflicting event", () => {
    const slots = findAvailability([ev("busy", "2026-06-08T09:00:00.000Z", "2026-06-08T10:00:00.000Z")], {
      start: MON_7AM,
      end: FRI_END,
      durationMinutes: 30,
      maxSlots: 1,
    });
    expect(slots[0].start).toBe("2026-06-08T10:00:00.000Z");
  });

  it("merges participant busy intervals from the query", () => {
    const slots = findAvailability([ev("busy", "2026-06-08T09:00:00.000Z", "2026-06-08T10:00:00.000Z")], {
      start: MON_7AM,
      end: FRI_END,
      durationMinutes: 30,
      maxSlots: 1,
      busy: [{ start: "2026-06-08T10:00:00.000Z", end: "2026-06-08T11:00:00.000Z" }],
    });
    expect(slots[0].start).toBe("2026-06-08T11:00:00.000Z");
  });

  it("honors maxSlots and an all-day block", () => {
    const slots = findAvailability([ev("off", "2026-06-08T00:00:00.000Z", "2026-06-08T00:00:00.000Z", { allDay: true })], {
      start: MON_7AM,
      end: FRI_END,
      durationMinutes: 60,
      maxSlots: 3,
    });
    expect(slots.length).toBe(3);
    // Monday is fully blocked → first slot must be Tuesday.
    expect(new Date(slots[0].start).getUTCDate()).toBe(9);
  });

  it("returns nothing for a non-positive window or duration", () => {
    expect(findAvailability([], { start: FRI_END, end: MON_7AM, durationMinutes: 30 })).toEqual([]);
    expect(findAvailability([], { start: MON_7AM, end: FRI_END, durationMinutes: 0 })).toEqual([]);
  });
});

describe("calendar — formatting", () => {
  it("formatSlot renders a UTC date + time range", () => {
    expect(formatSlot({ start: "2026-06-08T09:00:00.000Z", end: "2026-06-08T09:30:00.000Z" })).toBe(
      "Mon, Jun 8 · 9:00–9:30 AM"
    );
    expect(formatSlot({ start: "2026-06-08T11:30:00.000Z", end: "2026-06-08T12:30:00.000Z" })).toBe(
      "Mon, Jun 8 · 11:30 AM – 12:30 PM"
    );
  });

  it("formatAvailabilityText builds a paste-ready block", () => {
    const text = formatAvailabilityText(
      [{ start: "2026-06-08T09:00:00.000Z", end: "2026-06-08T09:30:00.000Z" }],
      { tzLabel: "UTC" }
    );
    expect(text).toContain("times in UTC");
    expect(text).toContain("• Mon, Jun 8 · 9:00–9:30 AM");
  });

  it("formatAvailabilityText degrades gracefully with no slots", () => {
    expect(formatAvailabilityText([])).toMatch(/couldn't find an open slot/i);
  });
});

describe("calendar — conflicts, events, creation", () => {
  it("hasConflict detects a collision", () => {
    const events = [ev("a", "2026-06-08T09:00:00.000Z", "2026-06-08T10:00:00.000Z")];
    expect(hasConflict(events, { start: "2026-06-08T09:30:00.000Z", end: "2026-06-08T10:30:00.000Z" })).toBe(true);
    expect(hasConflict(events, { start: "2026-06-08T10:00:00.000Z", end: "2026-06-08T10:30:00.000Z" })).toBe(false);
  });

  it("createEvent appends immutably and generates an id", () => {
    const before: CalendarEvent[] = [];
    const { events, event } = createEvent(before, { title: "Acme Sync", start: "x", end: "y" });
    expect(before.length).toBe(0); // original untouched
    expect(events.length).toBe(1);
    expect(event.id).toMatch(/^evt-1-acme-sync$/);
    expect(event.source).toBe("mock");
  });

  it("eventFromSlot carries the slot times and attendees", () => {
    const input = eventFromSlot({ start: "s", end: "e" }, "Chat", ["dana@acme.com"]);
    expect(input).toMatchObject({ title: "Chat", start: "s", end: "e", attendees: ["dana@acme.com"], conference: true });
  });

  it("eventsInRange filters + sorts; upcomingEvents drops past events", () => {
    const events = [
      ev("late", "2026-06-10T10:00:00.000Z", "2026-06-10T11:00:00.000Z"),
      ev("early", "2026-06-08T10:00:00.000Z", "2026-06-08T11:00:00.000Z"),
      ev("past", "2026-06-01T10:00:00.000Z", "2026-06-01T11:00:00.000Z"),
    ];
    const range = eventsInRange(events, "2026-06-07T00:00:00.000Z", "2026-06-11T00:00:00.000Z");
    expect(range.map((e) => e.id)).toEqual(["early", "late"]);
    const up = upcomingEvents(events, Date.parse("2026-06-09T00:00:00.000Z"));
    expect(up.map((e) => e.id)).toEqual(["late"]);
  });

  it("removeEvent drops an event by id, immutably", () => {
    const events = [
      ev("a", "2026-06-08T09:00:00.000Z", "2026-06-08T10:00:00.000Z"),
      ev("b", "2026-06-08T11:00:00.000Z", "2026-06-08T12:00:00.000Z"),
    ];
    const out = removeEvent(events, "a");
    expect(out.map((e) => e.id)).toEqual(["b"]);
    expect(events.length).toBe(2); // original untouched
  });

  it("removeEvent is a no-op for an unknown id", () => {
    const events = [ev("a", "2026-06-08T09:00:00.000Z", "2026-06-08T10:00:00.000Z")];
    expect(removeEvent(events, "zzz").map((e) => e.id)).toEqual(["a"]);
  });
});

describe("calendar — MockCalendarProvider", () => {
  it("lists, computes availability, and creates in-memory", async () => {
    const p = new MockCalendarProvider([ev("a", "2026-06-08T09:00:00.000Z", "2026-06-08T10:00:00.000Z")]);
    const listed = await p.list("2026-06-08T00:00:00.000Z", "2026-06-09T00:00:00.000Z");
    expect(listed.length).toBe(1);
    const slots = await p.availability({ start: MON_7AM, end: FRI_END, durationMinutes: 30, maxSlots: 1 });
    expect(slots[0].start).toBe("2026-06-08T10:00:00.000Z");
    const created = await p.create({ title: "New", start: "2026-06-08T12:00:00.000Z", end: "2026-06-08T12:30:00.000Z" });
    expect(created.id).toBeTruthy();
    expect(p.snapshot().length).toBe(2);
  });
});
