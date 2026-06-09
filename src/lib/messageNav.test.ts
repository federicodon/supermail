import { describe, it, expect } from "vitest";
import { neighborId, initialFocusId, focusIndex, atFirst, atLast } from "./messageNav";

const IDS = ["m1", "m2", "m3"];

describe("neighborId", () => {
  it("moves down and up within the thread", () => {
    expect(neighborId(IDS, "m1", 1)).toBe("m2");
    expect(neighborId(IDS, "m2", 1)).toBe("m3");
    expect(neighborId(IDS, "m3", -1)).toBe("m2");
  });

  it("clamps at the edges (no wrap)", () => {
    expect(neighborId(IDS, "m3", 1)).toBe("m3");
    expect(neighborId(IDS, "m1", -1)).toBe("m1");
  });

  it("enters from the correct end when nothing is focused", () => {
    expect(neighborId(IDS, null, 1)).toBe("m1");
    expect(neighborId(IDS, null, -1)).toBe("m3");
  });

  it("treats an unknown current id as no focus", () => {
    expect(neighborId(IDS, "ghost", 1)).toBe("m1");
  });

  it("returns null for an empty thread", () => {
    expect(neighborId([], null, 1)).toBeNull();
    expect(neighborId([], "x", -1)).toBeNull();
  });
});

describe("initialFocusId", () => {
  it("focuses the latest message", () => {
    expect(initialFocusId(IDS)).toBe("m3");
  });
  it("is null for an empty thread", () => {
    expect(initialFocusId([])).toBeNull();
  });
});

describe("focusIndex / atFirst / atLast", () => {
  it("reports the position", () => {
    expect(focusIndex(IDS, "m2")).toBe(1);
    expect(focusIndex(IDS, null)).toBe(-1);
    expect(focusIndex(IDS, "ghost")).toBe(-1);
  });
  it("detects the edges", () => {
    expect(atFirst(IDS, "m1")).toBe(true);
    expect(atFirst(IDS, "m2")).toBe(false);
    expect(atLast(IDS, "m3")).toBe(true);
    expect(atLast(IDS, "m2")).toBe(false);
    expect(atFirst([], null)).toBe(false);
    expect(atLast([], null)).toBe(false);
  });
});
