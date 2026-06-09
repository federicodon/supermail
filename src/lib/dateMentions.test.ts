import { describe, it, expect } from "vitest";
import { extractTimeMentions } from "./dateMentions";

// Fixed anchor (local), matching naturalTime.test conventions so the suite is
// timezone-independent. Thu Jan 15 2026, 10:30 local.
const NOW = new Date(2026, 0, 15, 10, 30, 0).getTime();
const DAY = 86_400_000;

function dayDelta(at: Date): number {
  const a = new Date(at);
  a.setHours(0, 0, 0, 0);
  const n = new Date(NOW);
  n.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - n.getTime()) / DAY);
}

describe("extractTimeMentions", () => {
  it("detects a full weekday with a time", () => {
    const m = extractTimeMentions("Can we circle back Friday at 5pm to confirm?", NOW);
    expect(m).toHaveLength(1);
    expect(m[0].at.getDay()).toBe(5); // Friday
    expect(m[0].at.getHours()).toBe(17);
    expect(m[0].at.getTime()).toBeGreaterThan(NOW);
    expect(m[0].ms).toBe(m[0].at.getTime() - NOW);
    expect(m[0].label).toBeTruthy();
  });

  it("detects 'tomorrow morning'", () => {
    const m = extractTimeMentions("Let's sync tomorrow morning before the standup.", NOW);
    expect(m).toHaveLength(1);
    expect(dayDelta(m[0].at)).toBe(1);
    expect(m[0].at.getHours()).toBe(8);
  });

  it("detects relative offsets", () => {
    const m = extractTimeMentions("I'll have the draft ready in 3 days.", NOW);
    expect(m).toHaveLength(1);
    expect(dayDelta(m[0].at)).toBe(3);
  });

  it("detects a weekday abbreviation only when a time follows it", () => {
    expect(extractTimeMentions("ping me mon 9am", NOW)).toHaveLength(1);
    // bare abbreviations in prose must NOT be read as dates
    expect(extractTimeMentions("I sat in the sun; we wed last spring.", NOW)).toHaveLength(0);
  });

  it("detects a 'by <time>' deadline", () => {
    const m = extractTimeMentions("Please reply by 9:30am.", NOW);
    expect(m).toHaveLength(1);
    expect(m[0].at.getHours()).toBe(9);
    expect(m[0].at.getMinutes()).toBe(30);
  });

  it("returns mentions soonest-first and de-duplicates instants", () => {
    const m = extractTimeMentions(
      "Options: Friday at 5pm, or tomorrow at 9am, or in 2 hours. Friday at 5pm again.",
      NOW
    );
    // "Friday at 5pm" appears twice but collapses to one.
    const times = m.map((x) => x.at.getTime());
    expect(new Set(times).size).toBe(times.length);
    // sorted ascending
    for (let i = 1; i < m.length; i++) expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    // soonest is "in 2 hours"
    expect(m[0].at.getTime() - NOW).toBeLessThan(3 * 3_600_000);
  });

  it("honors the max cap", () => {
    const text = "tomorrow 9am, monday 9am, tuesday 9am, wednesday 9am, friday 9am";
    expect(extractTimeMentions(text, NOW, 2)).toHaveLength(2);
  });

  it("returns nothing for text with no time references", () => {
    expect(extractTimeMentions("Thanks for the update, looks great.", NOW)).toEqual([]);
    expect(extractTimeMentions("", NOW)).toEqual([]);
  });

  it("detects 'end of day' and 'next week'", () => {
    const eod = extractTimeMentions("Can you get this done by end of day?", NOW);
    expect(eod.length).toBeGreaterThanOrEqual(1);
    const nw = extractTimeMentions("Let's revisit next week.", NOW);
    expect(nw).toHaveLength(1);
    expect(nw[0].at.getTime()).toBeGreaterThan(NOW);
  });
});
