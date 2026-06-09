import type { CalendarEvent } from "../lib/calendar";

// A realistic work-week of meetings, laid out relative to `now` so the calendar
// always shows genuinely upcoming events (mock mode only — never a real account).

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MIN = 60_000;

function startOfUTCDay(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function at(dayStart: number, h: number, m = 0): string {
  return new Date(dayStart + h * HOUR + m * MIN).toISOString();
}

export function freshMockCalendar(now: number = Date.now()): CalendarEvent[] {
  const base = startOfUTCDay(now);
  const dow = new Date(base).getUTCDay();
  // Monday of the current week (or today if today is Monday).
  const monday = base + (((1 - dow + 7) % 7) || 0) * DAY;
  const d = (n: number) => monday + n * DAY; // 0=Mon … 4=Fri

  const events: CalendarEvent[] = [
    {
      id: "c1",
      title: "Team standup",
      start: at(d(0), 9, 30),
      end: at(d(0), 9, 45),
      conference: true,
      attendees: ["team@growthcab.com"],
      source: "mock",
    },
    {
      id: "c2",
      title: "Acme account sync",
      start: at(d(0), 14),
      end: at(d(0), 15),
      conference: true,
      attendees: ["dana@acme.com"],
      location: "Zoom",
      source: "mock",
    },
    {
      id: "c3",
      title: "1:1 with Dana",
      start: at(d(1), 11),
      end: at(d(1), 11, 30),
      conference: true,
      attendees: ["dana@acme.com"],
      source: "mock",
    },
    {
      id: "c4",
      title: "Company offsite",
      start: at(d(2), 0),
      end: at(d(2), 0),
      allDay: true,
      source: "mock",
    },
    {
      id: "c5",
      title: "Design review",
      start: at(d(3), 13),
      end: at(d(3), 14),
      conference: true,
      attendees: ["sam@studio.io"],
      source: "mock",
    },
    {
      id: "c6",
      title: "Weekly wrap-up",
      start: at(d(4), 16),
      end: at(d(4), 16, 30),
      conference: true,
      source: "mock",
    },
  ];

  // Something later *today* so "Upcoming" is rarely empty during the work week.
  if (base + 17 * HOUR > now) {
    events.push({
      id: "c0",
      title: "Focus block — inbox zero",
      start: at(base, 17),
      end: at(base, 18),
      source: "mock",
    });
  }

  return events.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
