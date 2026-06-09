import { describe, expect, it } from "vitest";
import { smartTimeLabel, timeLabelKind } from "./timeLabels";

// Build instants in *local* time so calendar-day logic is timezone-stable.
const at = (y: number, m: number, d: number, h = 9, min = 30) => new Date(y, m, d, h, min).getTime();
const NOW = at(2026, 5, 9, 14, 0); // Tue Jun 9 2026, 14:00 local

describe("timeLabelKind", () => {
  it("same calendar day → time", () => {
    expect(timeLabelKind(new Date(at(2026, 5, 9, 0, 5)), NOW)).toBe("time");
    expect(timeLabelKind(new Date(at(2026, 5, 9, 23, 59)), NOW)).toBe("time");
  });

  it("previous calendar day → yesterday (even when <24h ago)", () => {
    expect(timeLabelKind(new Date(at(2026, 5, 8, 23, 0)), NOW)).toBe("yesterday");
    expect(timeLabelKind(new Date(at(2026, 5, 8, 1, 0)), NOW)).toBe("yesterday");
  });

  it("same year → short date; other year → date with year", () => {
    expect(timeLabelKind(new Date(at(2026, 2, 1)), NOW)).toBe("date");
    expect(timeLabelKind(new Date(at(2025, 11, 31)), NOW)).toBe("date-year");
  });

  it("handles month boundaries (Jan 1 vs Dec 31)", () => {
    const jan1 = at(2026, 0, 1, 10, 0);
    expect(timeLabelKind(new Date(at(2025, 11, 31, 22, 0)), jan1)).toBe("yesterday");
  });

  it("invalid input → date-year (renders empty label, never throws)", () => {
    expect(timeLabelKind("not a date", NOW)).toBe("date-year");
    expect(smartTimeLabel("not a date", NOW)).toBe("");
  });
});

describe("smartTimeLabel", () => {
  it("today renders a clock time", () => {
    expect(smartTimeLabel(new Date(at(2026, 5, 9, 9, 41)), NOW)).toMatch(/9.41/);
  });

  it("yesterday renders the word", () => {
    expect(smartTimeLabel(new Date(at(2026, 5, 8, 9, 0)), NOW)).toBe("Yesterday");
  });

  it("same year omits the year; older includes it", () => {
    expect(smartTimeLabel(new Date(at(2026, 2, 5)), NOW)).not.toMatch(/2026/);
    expect(smartTimeLabel(new Date(at(2024, 2, 5)), NOW)).toMatch(/2024/);
  });
});
