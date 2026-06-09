import { describe, it, expect } from "vitest";
import { type CalendarEvent } from "./calendar";
import {
  HOLD_WINDOW_DAYS,
  buildHold,
  findHoldForThread,
  heldTimeText,
  holdSummary,
  holdTitle,
  isHold,
  proposeHoldSlot,
} from "./holds";

// 2026-06-08 is a Monday in UTC (same reference week as calendar.test.ts), so
// weekday/weekend assertions are stable on any machine.
const MON_8AM = "2026-06-08T08:00:00.000Z"; // before the 9:00 work window opens

const ev = (id: string, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  title: id,
  start,
  end,
  source: "mock",
  ...extra,
});

describe("holds — proposeHoldSlot", () => {
  it("returns the first open working-hours slot from fromIso", () => {
    const slot = proposeHoldSlot([], { durationMinutes: 30, fromIso: MON_8AM });
    expect(slot).toEqual({ start: "2026-06-08T09:00:00.000Z", end: "2026-06-08T09:30:00.000Z" });
  });

  it("skips a conflicting event", () => {
    const events = [ev("c1", "2026-06-08T09:00:00.000Z", "2026-06-08T09:30:00.000Z")];
    const slot = proposeHoldSlot(events, { durationMinutes: 30, fromIso: MON_8AM });
    expect(slot).toEqual({ start: "2026-06-08T09:30:00.000Z", end: "2026-06-08T10:00:00.000Z" });
  });

  it("treats an existing tentative hold as busy (no double-book)", () => {
    const hold = ev("h1", "2026-06-08T09:00:00.000Z", "2026-06-08T09:30:00.000Z", {
      tentative: true,
      holdThreadId: "tA",
    });
    const slot = proposeHoldSlot([hold], { durationMinutes: 30, fromIso: MON_8AM });
    expect(slot?.start).toBe("2026-06-08T09:30:00.000Z");
  });

  it("honors the requested duration", () => {
    const slot = proposeHoldSlot([], { durationMinutes: 60, fromIso: MON_8AM });
    expect(slot).toEqual({ start: "2026-06-08T09:00:00.000Z", end: "2026-06-08T10:00:00.000Z" });
  });

  it("returns null when nothing is free in the window (weekend, 1-day window)", () => {
    // 2026-06-13 is a Saturday; a 1-day working-hours window has no open slot.
    const slot = proposeHoldSlot([], { durationMinutes: 30, fromIso: "2026-06-13T08:00:00.000Z", days: 1 });
    expect(slot).toBeNull();
  });

  it("returns null for a non-positive duration or bad date", () => {
    expect(proposeHoldSlot([], { durationMinutes: 0, fromIso: MON_8AM })).toBeNull();
    expect(proposeHoldSlot([], { durationMinutes: 30, fromIso: "not-a-date" })).toBeNull();
  });

  it("defaults to a 10-day search window", () => {
    expect(HOLD_WINDOW_DAYS).toBe(10);
  });
});

describe("holds — holdTitle", () => {
  it("prefixes the subject", () => {
    expect(holdTitle("Roadmap sync")).toBe("Hold: Roadmap sync");
  });

  it("strips Re:/Fwd: chains", () => {
    expect(holdTitle("Re: Fwd: Roadmap sync")).toBe("Hold: Roadmap sync");
    expect(holdTitle("RE: Fw: hi")).toBe("Hold: hi");
  });

  it("falls back when there is nothing to title", () => {
    expect(holdTitle("")).toBe("Hold: meeting");
    expect(holdTitle(undefined)).toBe("Hold: meeting");
    expect(holdTitle("   ")).toBe("Hold: meeting");
  });

  it("truncates a very long subject", () => {
    const t = holdTitle("x".repeat(100));
    expect(t.startsWith("Hold: ")).toBe(true);
    expect(t.endsWith("…")).toBe(true);
    expect(t.length).toBeLessThanOrEqual("Hold: ".length + 60);
  });
});

describe("holds — buildHold", () => {
  const slot = { start: "2026-06-08T09:00:00.000Z", end: "2026-06-08T09:30:00.000Z" };

  it("builds a tentative, thread-linked payload", () => {
    const h = buildHold(slot, { threadId: "t1", subject: "Roadmap", attendees: ["dana@acme.com"] });
    expect(h.tentative).toBe(true);
    expect(h.holdThreadId).toBe("t1");
    expect(h.title).toBe("Hold: Roadmap");
    expect(h.start).toBe(slot.start);
    expect(h.end).toBe(slot.end);
    expect(h.attendees).toEqual(["dana@acme.com"]);
    expect(h.conference).toBe(true);
    expect(h.source).toBe("mock");
  });

  it("omits attendees when none are given", () => {
    expect(buildHold(slot, { threadId: "t1" }).attendees).toBeUndefined();
    expect(buildHold(slot, { threadId: "t1", attendees: [] }).attendees).toBeUndefined();
  });

  it("copies the attendees array (no aliasing the caller's)", () => {
    const att = ["a@x.com"];
    expect(buildHold(slot, { threadId: "t1", attendees: att }).attendees).not.toBe(att);
  });
});

describe("holds — findHoldForThread / isHold", () => {
  it("finds the tentative event for a thread, ignoring confirmed events", () => {
    const events = [
      ev("c1", "2026-06-08T14:00:00.000Z", "2026-06-08T15:00:00.000Z"),
      ev("h1", "2026-06-09T09:00:00.000Z", "2026-06-09T09:30:00.000Z", { tentative: true, holdThreadId: "t1" }),
    ];
    expect(findHoldForThread(events, "t1")?.id).toBe("h1");
    expect(findHoldForThread(events, "t2")).toBeUndefined();
  });

  it("returns the earliest when more than one is held for the thread", () => {
    const events = [
      ev("h2", "2026-06-10T09:00:00.000Z", "2026-06-10T09:30:00.000Z", { tentative: true, holdThreadId: "t1" }),
      ev("h1", "2026-06-09T09:00:00.000Z", "2026-06-09T09:30:00.000Z", { tentative: true, holdThreadId: "t1" }),
    ];
    expect(findHoldForThread(events, "t1")?.id).toBe("h1");
  });

  it("isHold reflects the tentative flag", () => {
    expect(isHold(ev("c1", "2026-06-08T09:00:00.000Z", "2026-06-08T09:30:00.000Z"))).toBe(false);
    expect(isHold(ev("h1", "2026-06-08T09:00:00.000Z", "2026-06-08T09:30:00.000Z", { tentative: true }))).toBe(true);
  });
});

describe("holds — holdSummary", () => {
  it("renders the slot like the calendar", () => {
    expect(holdSummary({ start: "2026-06-08T09:00:00.000Z", end: "2026-06-08T09:30:00.000Z" })).toBe(
      "Mon, Jun 8 · 9:00–9:30 AM"
    );
  });
});

describe("holds — heldTimeText", () => {
  const slot = { start: "2026-06-08T09:00:00.000Z", end: "2026-06-08T09:30:00.000Z" };

  it("proposes the specific held slot", () => {
    const text = heldTimeText(slot);
    expect(text).toContain("Mon, Jun 8 · 9:00–9:30 AM");
    expect(text).toMatch(/tentatively held/i);
    expect(text).toMatch(/work for you/i);
  });

  it("appends a timezone label when given", () => {
    expect(heldTimeText(slot, { tzLabel: "UTC" })).toContain("(UTC)");
    expect(heldTimeText(slot)).not.toContain("(UTC)");
  });
});
