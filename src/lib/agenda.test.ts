import { describe, it, expect } from "vitest";
import {
  buildAgenda,
  groupAgendaByDay,
  relativeDayLabel,
  agendaSummary,
  agendaTodayCount,
  agendaTimeText,
  type AgendaInput,
} from "./agenda";
import { email } from "./testEmail";
import type { CalendarEvent } from "./calendar";
import type { Draft, OutboxItem } from "../types";

const NOW = Date.parse("2026-06-08T12:00:00.000Z"); // a fixed Monday noon UTC
const DAY = 86_400_000;

function ev(over: Partial<CalendarEvent> & { id: string; start: string; end: string }): CalendarEvent {
  return { title: "Meeting", source: "mock", ...over };
}

function out(over: Partial<OutboxItem> & { id: string; sendAt: string }): OutboxItem {
  const { draft: draftOver, ...rest } = over;
  const draft: Draft = { id: `d-${over.id}`, to: "dana@acme.io", subject: "Re: plan", body: "...", ...(draftOver ?? {}) };
  return { status: "scheduled", createdAt: "2026-06-08T11:00:00.000Z", draft, ...rest };
}

function fullInput(): AgendaInput {
  return {
    emails: [
      // overdue reminder (today, before now)
      email({ id: "m-rem", threadId: "t-rem", subject: "Ping Marcus", reminderAt: "2026-06-08T09:00:00.000Z" }),
      // future reminder (tomorrow)
      email({ id: "m-rem2", threadId: "t-rem2", subject: "Review doc", reminderAt: "2026-06-09T09:00:00.000Z" }),
      // follow-up that already got a reply → dropped
      email({ id: "m-fu", threadId: "t-fu", subject: "Awaiting Sam", outbound: true, reminderAt: "2026-06-07T09:00:00.000Z", remindIfNoReply: true }),
      email({ id: "m-fu-reply", threadId: "t-fu", subject: "Awaiting Sam", date: "2026-06-07T10:00:00.000Z" }),
      // follow-up still unanswered → kept
      email({ id: "m-fu2", threadId: "t-fu2", subject: "Nudge Priya", outbound: true, to: [{ name: "Priya Patel", email: "priya@x.io" }], reminderAt: "2026-06-10T09:00:00.000Z", remindIfNoReply: true }),
      // snoozed returning tomorrow
      email({ id: "m-sn", threadId: "t-sn", subject: "Snoozed digest", snoozedUntil: "2026-06-09T08:00:00.000Z" }),
    ],
    events: [
      ev({ id: "c-past", start: "2026-06-08T08:00:00.000Z", end: "2026-06-08T09:00:00.000Z", title: "Done standup" }),
      ev({ id: "c-now", start: "2026-06-08T15:00:00.000Z", end: "2026-06-08T16:00:00.000Z", title: "Acme sync", conference: true }),
      ev({ id: "c-tom", start: "2026-06-09T10:00:00.000Z", end: "2026-06-09T10:30:00.000Z", title: "1:1", location: "Room 2" }),
    ],
    outbox: [
      out({ id: "o-1", sendAt: "2026-06-08T18:00:00.000Z" }),
      out({ id: "o-2", sendAt: "2026-06-08T19:00:00.000Z", status: "canceled" }),
    ],
  };
}

describe("buildAgenda", () => {
  it("labels a tentative hold distinctly (icon + subtitle)", () => {
    const items = buildAgenda(
      {
        emails: [],
        events: [
          ev({
            id: "h1",
            start: "2026-06-09T09:00:00.000Z",
            end: "2026-06-09T09:30:00.000Z",
            title: "Hold: Roadmap",
            tentative: true,
            holdThreadId: "t1",
            conference: true,
          }),
        ],
        outbox: [],
      },
      NOW
    );
    const hold = items.find((i) => i.id === "event:h1");
    expect(hold?.icon).toBe("📌");
    expect(hold?.subtitle).toBe("Tentative hold");
  });

  it("merges every time-anchored source and sorts by instant", () => {
    const items = buildAgenda(fullInput(), NOW);
    const ids = items.map((i) => i.id);
    // past event + replied follow-up + canceled send are all excluded
    expect(ids).not.toContain("event:c-past");
    expect(ids).not.toContain("followup:t-fu");
    expect(ids).not.toContain("send:o-2");
    // everything else present
    expect(ids).toEqual(
      expect.arrayContaining([
        "reminder:t-rem",
        "reminder:t-rem2",
        "followup:t-fu2",
        "snoozed:t-sn",
        "event:c-now",
        "event:c-tom",
        "send:o-1",
      ])
    );
    // sorted ascending by ts
    const ts = items.map((i) => i.ts);
    expect([...ts]).toEqual([...ts].sort((a, b) => a - b));
  });

  it("flags overdue task-like items but never events", () => {
    const items = buildAgenda(fullInput(), NOW);
    expect(items.find((i) => i.id === "reminder:t-rem")!.overdue).toBe(true);
    expect(items.find((i) => i.id === "reminder:t-rem2")!.overdue).toBe(false);
    expect(items.find((i) => i.id === "event:c-now")!.overdue).toBe(false);
  });

  it("classifies kinds and names the follow-up counterpart", () => {
    const items = buildAgenda(fullInput(), NOW);
    const fu = items.find((i) => i.id === "followup:t-fu2")!;
    expect(fu.kind).toBe("followup");
    expect(fu.subtitle).toContain("Priya");
    expect(items.find((i) => i.id === "send:o-1")!.subtitle).toContain("dana@acme.io");
    expect(items.find((i) => i.id === "snoozed:t-sn")!.refKind).toBe("thread");
    expect(items.find((i) => i.id === "event:c-now")!.refKind).toBe("event");
    expect(items.find((i) => i.id === "send:o-1")!.refKind).toBe("outbox");
  });

  it("collapses multiple reminders on one thread into a single row (latest msg)", () => {
    const input: AgendaInput = {
      emails: [
        email({ id: "a", threadId: "t", date: "2026-06-08T08:00:00.000Z", reminderAt: "2026-06-10T09:00:00.000Z" }),
        email({ id: "b", threadId: "t", date: "2026-06-08T10:00:00.000Z", reminderAt: "2026-06-10T09:00:00.000Z", subject: "Newest" }),
      ],
      events: [],
      outbox: [],
    };
    const items = buildAgenda(input, NOW);
    const rem = items.filter((i) => i.kind === "reminder");
    expect(rem).toHaveLength(1);
    expect(rem[0].refId).toBe("b"); // the latest-dated message represents the thread
    expect(rem[0].title).toBe("Newest");
  });

  it("ignores trashed messages", () => {
    const input: AgendaInput = {
      emails: [email({ id: "x", threadId: "tx", reminderAt: "2026-06-10T09:00:00.000Z", trashed: true })],
      events: [],
      outbox: [],
    };
    expect(buildAgenda(input, NOW)).toHaveLength(0);
  });
});

describe("groupAgendaByDay", () => {
  it("buckets overdue first, then chronological days with relative labels", () => {
    const items = buildAgenda(fullInput(), NOW);
    const days = groupAgendaByDay(items, NOW);
    expect(days[0].label).toBe("Overdue");
    expect(days[0].overdue).toBe(true);
    expect(days[0].items.map((i) => i.id)).toEqual(["reminder:t-rem"]);
    expect(days[1].label).toBe("Today");
    expect(days[1].items.map((i) => i.id)).toEqual(["event:c-now", "send:o-1"]);
    expect(days[2].label).toBe("Tomorrow");
    // tomorrow holds the future reminder, the snoozed return, and the 1:1
    expect(days[2].items.map((i) => i.id).sort()).toEqual(
      ["event:c-tom", "reminder:t-rem2", "snoozed:t-sn"].sort()
    );
  });

  it("omits the overdue bucket when nothing is late", () => {
    const items = buildAgenda(
      { emails: [email({ id: "m", threadId: "t", reminderAt: "2026-06-09T09:00:00.000Z" })], events: [], outbox: [] },
      NOW
    );
    const days = groupAgendaByDay(items, NOW);
    expect(days.every((d) => d.key !== "overdue")).toBe(true);
  });
});

describe("relativeDayLabel", () => {
  it("names today / tomorrow / yesterday and falls back to a date", () => {
    const today = Date.UTC(2026, 5, 8);
    expect(relativeDayLabel(today, NOW)).toBe("Today");
    expect(relativeDayLabel(today + DAY, NOW)).toBe("Tomorrow");
    expect(relativeDayLabel(today - DAY, NOW)).toBe("Yesterday");
    expect(relativeDayLabel(today + 5 * DAY, NOW)).toBe("Sat, Jun 13");
  });
});

describe("agendaSummary + counts", () => {
  it("tallies by kind, overdue, and the next upcoming item", () => {
    const items = buildAgenda(fullInput(), NOW);
    const s = agendaSummary(items, NOW);
    expect(s.events).toBe(2);
    expect(s.reminders).toBe(3); // overdue reminder + future reminder + a follow-up
    expect(s.snoozed).toBe(1);
    expect(s.sends).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.next!.ts).toBeGreaterThanOrEqual(NOW);
    expect(s.next!.id).toBe("event:c-now"); // soonest item ahead of now
  });

  it("agendaTodayCount counts items landing today or already overdue", () => {
    const items = buildAgenda(fullInput(), NOW);
    // overdue reminder + the Acme sync + the scheduled send all land by tonight
    expect(agendaTodayCount(items, NOW)).toBe(3);
  });
});

describe("agendaTimeText", () => {
  it("renders all-day, an event range, and a point-in-time", () => {
    const items = buildAgenda(fullInput(), NOW);
    expect(agendaTimeText(items.find((i) => i.id === "event:c-now")!)).toBe("3:00–4:00 PM");
    expect(agendaTimeText(items.find((i) => i.id === "reminder:t-rem")!)).toBe("9:00 AM");
    const allDay = buildAgenda(
      { emails: [], events: [{ id: "ad", title: "Offsite", start: "2026-06-08T00:00:00.000Z", end: "2026-06-08T00:00:00.000Z", allDay: true, source: "mock" }], outbox: [] },
      NOW
    );
    expect(agendaTimeText(allDay[0])).toBe("All day");
  });
});
