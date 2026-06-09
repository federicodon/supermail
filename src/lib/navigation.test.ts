import { describe, it, expect } from "vitest";
import { nextAfterRemoval, neighborIndex } from "./navigation";

describe("nextAfterRemoval", () => {
  const ids = ["a", "b", "c", "d"];

  it("focuses the next row down, keeping its index (it slides up)", () => {
    expect(nextAfterRemoval(ids, "b")).toEqual({ id: "c", index: 1 });
    expect(nextAfterRemoval(ids, "a")).toEqual({ id: "b", index: 0 });
  });

  it("falls back to the previous row when the last is removed", () => {
    expect(nextAfterRemoval(ids, "d")).toEqual({ id: "c", index: 2 });
  });

  it("returns nothing when the only row is removed (list goes empty)", () => {
    expect(nextAfterRemoval(["solo"], "solo")).toEqual({ id: null, index: -1 });
  });

  it("returns nothing when the id is not present", () => {
    expect(nextAfterRemoval(ids, "zzz")).toEqual({ id: null, index: -1 });
    expect(nextAfterRemoval([], "a")).toEqual({ id: null, index: -1 });
  });

  it("the focused id always exists in the post-removal list (except when empty)", () => {
    for (const removed of ids) {
      const { id } = nextAfterRemoval(ids, removed);
      const after = ids.filter((x) => x !== removed);
      if (id !== null) expect(after).toContain(id);
    }
  });
});

describe("neighborIndex", () => {
  it("steps forward and backward by one", () => {
    expect(neighborIndex(4, 1, 1)).toBe(2);
    expect(neighborIndex(4, 2, -1)).toBe(1);
  });

  it("clamps at the edges (no wrap)", () => {
    expect(neighborIndex(4, 3, 1)).toBe(3); // already last
    expect(neighborIndex(4, 0, -1)).toBe(0); // already first
  });

  it("lands on row 0 for a first forward step with nothing selected", () => {
    expect(neighborIndex(4, -1, 1)).toBe(0);
  });

  it("clamps a backward step from an unselected/out-of-range cursor", () => {
    expect(neighborIndex(4, -1, -1)).toBe(0);
    expect(neighborIndex(4, 99, 1)).toBe(3);
    expect(neighborIndex(4, 99, -1)).toBe(2);
  });

  it("returns -1 for an empty list", () => {
    expect(neighborIndex(0, 0, 1)).toBe(-1);
    expect(neighborIndex(0, -1, -1)).toBe(-1);
  });
});
