import { describe, it, expect } from "vitest";
import { toggleId, rangeIds, withRange, allSelected, toggleAll, prune } from "./selection";

describe("selection helpers", () => {
  it("toggles ids immutably", () => {
    const a = toggleId([], "x");
    expect([...a]).toEqual(["x"]);
    const b = toggleId(a, "x");
    expect([...b]).toEqual([]);
    expect([...a]).toEqual(["x"]); // original untouched
  });

  it("computes inclusive ranges regardless of direction", () => {
    const ordered = ["a", "b", "c", "d"];
    expect(rangeIds(ordered, 1, 3)).toEqual(["b", "c", "d"]);
    expect(rangeIds(ordered, 3, 1)).toEqual(["b", "c", "d"]);
    expect(rangeIds(ordered, -5, 1)).toEqual(["a", "b"]); // clamped
    expect(rangeIds([], 0, 2)).toEqual([]);
  });

  it("adds a range to an existing selection", () => {
    const next = withRange(["a"], ["a", "b", "c", "d"], 1, 2);
    expect([...next].sort()).toEqual(["a", "b", "c"]);
  });

  it("detects and toggles all", () => {
    const ordered = ["a", "b"];
    expect(allSelected(ordered, new Set(["a", "b"]))).toBe(true);
    expect(allSelected(ordered, new Set(["a"]))).toBe(false);
    expect(allSelected([], new Set())).toBe(false);
    expect([...toggleAll(ordered, new Set())].sort()).toEqual(["a", "b"]);
    expect([...toggleAll(ordered, new Set(["a", "b"]))]).toEqual([]);
  });

  it("prunes ids that are no longer visible", () => {
    expect([...prune(new Set(["a", "b", "c"]), ["a", "c"])].sort()).toEqual(["a", "c"]);
  });
});
