import { describe, it, expect } from "vitest";
import {
  parseNaturalTime,
  parseClock,
  formatWhen,
  formatTime,
  nextWeekday,
  presetSubtitle,
  SNOOZE_SMART_PRESETS,
  REMIND_SMART_PRESETS,
  SEND_LATER_SMART_PRESETS,
  DEFAULT_MORNING,
} from "./naturalTime";

// A fixed anchor. We assert on local Date fields (getHours/getDate/getDay) and
// relative offsets so the suite is timezone-independent.
const NOW = new Date(2026, 0, 15, 10, 30, 0).getTime(); // Thu Jan 15 2026, 10:30 local

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

function dayDelta(at: Date, now = NOW): number {
  const a = new Date(at);
  a.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - n.getTime()) / DAY);
}

describe("parseClock", () => {
  it("parses 12-hour am/pm", () => {
    expect(parseClock("9am")).toEqual([9, 0]);
    expect(parseClock("9:30am")).toEqual([9, 30]);
    expect(parseClock("12pm")).toEqual([12, 0]); // noon
    expect(parseClock("12am")).toEqual([0, 0]); // midnight
    expect(parseClock("5 pm")).toEqual([17, 0]);
    expect(parseClock("11:45 p.m.")).toEqual([23, 45]);
  });
  it("parses 24-hour and bare hours", () => {
    expect(parseClock("14:00")).toEqual([14, 0]);
    expect(parseClock("17")).toEqual([17, 0]);
    expect(parseClock("9")).toEqual([9, 0]);
  });
  it("parses day-part keywords", () => {
    expect(parseClock("noon")).toEqual([12, 0]);
    expect(parseClock("evening")).toEqual([18, 0]);
    expect(parseClock("morning")).toEqual([8, 0]);
  });
  it("rejects nonsense and out-of-range", () => {
    expect(parseClock("banana")).toBeNull();
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock("13pm")).toBeNull();
    expect(parseClock("9:99")).toBeNull();
    expect(parseClock("")).toBeNull();
  });
});

describe("parseNaturalTime — offsets", () => {
  it("parses minute/hour offsets exactly", () => {
    expect(parseNaturalTime("in 2 hours", NOW)!.at.getTime() - NOW).toBe(2 * HOUR);
    expect(parseNaturalTime("in 30 minutes", NOW)!.at.getTime() - NOW).toBe(30 * MIN);
    expect(parseNaturalTime("90m", NOW)!.at.getTime() - NOW).toBe(90 * MIN);
    expect(parseNaturalTime("in an hour", NOW)!.at.getTime() - NOW).toBe(HOUR);
    expect(parseNaturalTime("2h", NOW)!.at.getTime() - NOW).toBe(2 * HOUR);
  });
  it("parses day/week offsets", () => {
    expect(parseNaturalTime("in 3 days", NOW)!.at.getTime() - NOW).toBe(3 * DAY);
    expect(parseNaturalTime("in a week", NOW)!.at.getTime() - NOW).toBe(7 * DAY);
    expect(parseNaturalTime("in 2 weeks", NOW)!.at.getTime() - NOW).toBe(14 * DAY);
  });
  it("parses day offset with an explicit time", () => {
    const r = parseNaturalTime("in 3 days at 9am", NOW)!;
    expect(r.at.getHours()).toBe(9);
    expect(r.at.getMinutes()).toBe(0);
    expect(dayDelta(r.at)).toBe(3);
  });
  it("parses month offsets via calendar arithmetic", () => {
    const r = parseNaturalTime("in 2 months", NOW)!;
    expect(r.at.getMonth()).toBe(2); // Jan + 2 = Mar
    expect(parseNaturalTime("in a month", NOW)!.at.getMonth()).toBe(1); // Feb
  });
});

describe("parseNaturalTime — day anchors", () => {
  it("tomorrow defaults to the morning hour", () => {
    const r = parseNaturalTime("tomorrow", NOW)!;
    expect(dayDelta(r.at)).toBe(1);
    expect(r.at.getHours()).toBe(DEFAULT_MORNING[0]);
    expect(r.at.getMinutes()).toBe(0);
  });
  it("tomorrow with a time", () => {
    const r = parseNaturalTime("tomorrow at 9am", NOW)!;
    expect(dayDelta(r.at)).toBe(1);
    expect(r.at.getHours()).toBe(9);
    const r2 = parseNaturalTime("tomorrow 2pm", NOW)!;
    expect(r2.at.getHours()).toBe(14);
    expect(dayDelta(r2.at)).toBe(1);
  });
  it("tomorrow with a day-part", () => {
    const r = parseNaturalTime("tomorrow evening", NOW)!;
    expect(dayDelta(r.at)).toBe(1);
    expect(r.at.getHours()).toBe(18);
  });
  it("this afternoon / this morning resolve to today's part", () => {
    const r = parseNaturalTime("this afternoon", NOW)!;
    expect(dayDelta(r.at)).toBe(0);
    expect(r.at.getHours()).toBe(13);
  });
  it("tonight resolves to 8pm today (NOW is morning)", () => {
    const r = parseNaturalTime("tonight", NOW)!;
    expect(dayDelta(r.at)).toBe(0);
    expect(r.at.getHours()).toBe(20);
  });
  it("a past day-part bumps to the next day", () => {
    const evening = new Date(2026, 0, 15, 22, 0, 0).getTime(); // 10pm
    const r = parseNaturalTime("this evening", evening)!;
    expect(dayDelta(r.at, evening)).toBe(1); // bumped to tomorrow
    expect(r.at.getHours()).toBe(18);
  });
  it("weekday lands on the next occurrence in the future", () => {
    // NOW is Thursday (getDay()===4). "monday" → next Monday.
    const r = parseNaturalTime("monday", NOW)!;
    expect(r.at.getDay()).toBe(1);
    expect(r.at.getTime()).toBeGreaterThan(NOW);
    expect(r.at.getHours()).toBe(DEFAULT_MORNING[0]);
  });
  it("weekday with a time", () => {
    const r = parseNaturalTime("friday 5pm", NOW)!;
    expect(r.at.getDay()).toBe(5);
    expect(r.at.getHours()).toBe(17);
  });
  it("abbreviated weekday", () => {
    expect(parseNaturalTime("tue", NOW)!.at.getDay()).toBe(2);
    expect(parseNaturalTime("weds", NOW)!.at.getDay()).toBe(3);
  });
  it("next week → next Monday morning", () => {
    const r = parseNaturalTime("next week", NOW)!;
    expect(r.at.getDay()).toBe(1);
    expect(r.at.getHours()).toBe(DEFAULT_MORNING[0]);
    expect(dayDelta(r.at)).toBeGreaterThanOrEqual(4); // strictly after this week
  });
  it("this weekend → upcoming Saturday", () => {
    const r = parseNaturalTime("this weekend", NOW)!;
    expect(r.at.getDay()).toBe(6);
    expect(r.at.getTime()).toBeGreaterThan(NOW);
  });
  it("end of day → 5pm", () => {
    const r = parseNaturalTime("end of day", NOW)!;
    expect(r.at.getHours()).toBe(17);
    expect(dayDelta(r.at)).toBe(0);
  });
});

describe("parseNaturalTime — bare time & lead-ins", () => {
  it("bare future time stays today", () => {
    const r = parseNaturalTime("2pm", NOW)!; // NOW is 10:30am → 2pm today
    expect(r.at.getHours()).toBe(14);
    expect(dayDelta(r.at)).toBe(0);
  });
  it("bare past time bumps to tomorrow", () => {
    const r = parseNaturalTime("9am", NOW)!; // NOW is 10:30am → 9am tomorrow
    expect(r.at.getHours()).toBe(9);
    expect(dayDelta(r.at)).toBe(1);
  });
  it("strips conversational lead-ins", () => {
    const a = parseNaturalTime("remind me tomorrow", NOW)!;
    expect(dayDelta(a.at)).toBe(1);
    const b = parseNaturalTime("snooze until monday", NOW); // 'until' not stripped → still works via weekday? no
    // 'snooze' is stripped, leaving 'until monday' which is not parseable
    expect(b).toBeNull();
    const c = parseNaturalTime("send it in 1 hour", NOW)!;
    expect(c.at.getTime() - NOW).toBe(HOUR);
  });
  it("returns null for empty / unparseable input", () => {
    expect(parseNaturalTime("", NOW)).toBeNull();
    expect(parseNaturalTime("   ", NOW)).toBeNull();
    expect(parseNaturalTime("whenever you feel like it", NOW)).toBeNull();
    expect(parseNaturalTime("in 5 bananas", NOW)).toBeNull();
  });
});

describe("formatting", () => {
  it("formatTime renders 12-hour clock", () => {
    expect(formatTime(new Date(2026, 0, 15, 8, 0))).toBe("8:00 AM");
    expect(formatTime(new Date(2026, 0, 15, 13, 5))).toBe("1:05 PM");
    expect(formatTime(new Date(2026, 0, 15, 0, 0))).toBe("12:00 AM");
    expect(formatTime(new Date(2026, 0, 15, 12, 0))).toBe("12:00 PM");
  });
  it("formatWhen uses relative day words", () => {
    expect(formatWhen(new Date(2026, 0, 15, 17, 0), NOW)).toBe("Today at 5:00 PM");
    expect(formatWhen(new Date(2026, 0, 16, 8, 0), NOW)).toBe("Tomorrow at 8:00 AM");
    // 3 days out (Sun) → weekday label
    expect(formatWhen(new Date(2026, 0, 18, 9, 0), NOW)).toBe("Sun at 9:00 AM");
    // far out → month/day
    expect(formatWhen(new Date(2026, 1, 10, 9, 0), NOW)).toBe("Feb 10 at 9:00 AM");
  });
});

describe("nextWeekday", () => {
  it("returns a future date on the requested weekday", () => {
    const d = nextWeekday(NOW, 1, DEFAULT_MORNING); // Monday
    expect(d.getDay()).toBe(1);
    expect(d.getTime()).toBeGreaterThan(NOW);
  });
  it("forceNext pushes a same-day request a week out", () => {
    // Early Thursday so "this Thursday 8am" is still in the future.
    const thursdayDawn = new Date(2026, 0, 15, 6, 0, 0).getTime(); // Thu 6am
    const same = nextWeekday(thursdayDawn, 4, DEFAULT_MORNING);
    const next = nextWeekday(thursdayDawn, 4, DEFAULT_MORNING, true);
    expect(dayDelta(same, thursdayDawn)).toBe(0); // today
    expect(next.getTime() - same.getTime()).toBe(7 * DAY);
  });
});

describe("smart presets", () => {
  it("all snooze presets resolve to the future with labels", () => {
    for (const p of SNOOZE_SMART_PRESETS) {
      const at = p.resolve(NOW);
      expect(at.getTime()).toBeGreaterThan(NOW);
      expect(presetSubtitle(p, NOW)).toMatch(/at \d/);
    }
  });
  it("snooze 'Tomorrow' is tomorrow morning", () => {
    const p = SNOOZE_SMART_PRESETS.find((x) => x.id === "tomorrow")!;
    const at = p.resolve(NOW);
    expect(dayDelta(at)).toBe(1);
    expect(at.getHours()).toBe(DEFAULT_MORNING[0]);
  });
  it("remind & send-later presets all resolve to the future", () => {
    for (const p of [...REMIND_SMART_PRESETS, ...SEND_LATER_SMART_PRESETS]) {
      expect(p.resolve(NOW).getTime()).toBeGreaterThan(NOW);
    }
  });
  it("send-later 'In 30 minutes' is exactly +30m", () => {
    const p = SEND_LATER_SMART_PRESETS.find((x) => x.id === "30m")!;
    expect(p.resolve(NOW).getTime() - NOW).toBe(30 * MIN);
  });
});
