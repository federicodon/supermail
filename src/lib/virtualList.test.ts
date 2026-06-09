import { describe, expect, it } from "vitest";
import { followScrollTop, rowHeightFor, virtualWindow, ROW_HEIGHT, ROW_HEIGHT_COMPACT } from "./virtualList";

describe("virtualWindow", () => {
  it("renders everything when the list fits the viewport", () => {
    const w = virtualWindow(10, 40, 0, 800, 5);
    expect(w.start).toBe(0);
    expect(w.end).toBe(10);
    expect(w.topPad).toBe(0);
    expect(w.bottomPad).toBe(0);
  });

  it("windows a long list around the scroll position with overscan", () => {
    // 10,000 rows × 40px, scrolled to row 2500, 600px viewport, overscan 10.
    const w = virtualWindow(10_000, 40, 2500 * 40, 600, 10);
    expect(w.start).toBe(2490);
    expect(w.end).toBe(2500 + 16 + 10); // 15 visible + 1 partial + overscan
    expect(w.topPad).toBe(2490 * 40);
    expect(w.bottomPad).toBe((10_000 - w.end) * 40);
    // The DOM cost is bounded regardless of list size.
    expect(w.end - w.start).toBeLessThan(60);
  });

  it("clamps at the end of the list", () => {
    const w = virtualWindow(100, 40, 100 * 40, 600, 10);
    expect(w.end).toBe(100);
    expect(w.bottomPad).toBe(0);
    expect(w.start).toBeLessThanOrEqual(100);
  });

  it("total height is invariant: pads + rendered rows = count × rowHeight", () => {
    for (const scrollTop of [0, 333, 4000, 39_960]) {
      const w = virtualWindow(1000, 40, scrollTop, 613, 7);
      expect(w.topPad + (w.end - w.start) * 40 + w.bottomPad).toBe(1000 * 40);
    }
  });

  it("empty list and zero row height are safe", () => {
    expect(virtualWindow(0, 40, 0, 600)).toEqual({ start: 0, end: 0, topPad: 0, bottomPad: 0 });
    expect(virtualWindow(10, 0, 0, 600)).toEqual({ start: 0, end: 0, topPad: 0, bottomPad: 0 });
  });
});

describe("followScrollTop", () => {
  it("returns null when the row is already fully visible", () => {
    expect(followScrollTop(5, 40, 0, 600)).toBeNull();
    expect(followScrollTop(14, 40, 0, 600)).toBeNull(); // 14*40+40 = 600 exactly
  });

  it("scrolls up just enough when the row is above the viewport", () => {
    expect(followScrollTop(3, 40, 500, 600)).toBe(120);
  });

  it("scrolls down just enough when the row is below the viewport", () => {
    expect(followScrollTop(20, 40, 0, 600)).toBe(20 * 40 + 40 - 600);
  });

  it("never returns a negative scrollTop and ignores invalid input", () => {
    expect(followScrollTop(0, 40, 500, 600)).toBe(0);
    expect(followScrollTop(-1, 40, 0, 600)).toBeNull();
    expect(followScrollTop(5, 0, 0, 600)).toBeNull();
  });
});

describe("rowHeightFor", () => {
  it("maps density to the CSS row heights", () => {
    expect(rowHeightFor("compact")).toBe(ROW_HEIGHT_COMPACT);
    expect(rowHeightFor("comfortable")).toBe(ROW_HEIGHT);
    expect(rowHeightFor(undefined)).toBe(ROW_HEIGHT);
  });
});
