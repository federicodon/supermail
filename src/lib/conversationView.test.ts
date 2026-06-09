import { describe, it, expect } from "vitest";
import {
  defaultExpanded,
  toggleExpanded,
  expandAll,
  collapseToLatest,
  allExpanded,
  expandToggleLabel,
  collapsedCount,
} from "./conversationView";

const ids = ["a", "b", "c"];

describe("conversationView", () => {
  it("opens with only the latest message expanded", () => {
    const e = defaultExpanded(ids);
    expect([...e]).toEqual(["c"]);
    expect(defaultExpanded([]).size).toBe(0);
  });

  it("toggles a single message immutably", () => {
    const e = defaultExpanded(ids);
    const opened = toggleExpanded(e, "a");
    expect(opened.has("a")).toBe(true);
    expect(e.has("a")).toBe(false); // original untouched
    const closed = toggleExpanded(opened, "a");
    expect(closed.has("a")).toBe(false);
  });

  it("expands and collapses the whole thread", () => {
    expect([...expandAll(ids)]).toEqual(ids);
    expect([...collapseToLatest(ids)]).toEqual(["c"]);
  });

  it("knows when all are expanded", () => {
    expect(allExpanded(expandAll(ids), ids)).toBe(true);
    expect(allExpanded(defaultExpanded(ids), ids)).toBe(false);
    expect(allExpanded(new Set(), [])).toBe(false);
  });

  it("labels the whole-thread toggle by current state", () => {
    expect(expandToggleLabel(defaultExpanded(ids), ids)).toEqual({
      willExpand: true,
      label: "Expand all",
    });
    expect(expandToggleLabel(expandAll(ids), ids)).toEqual({
      willExpand: false,
      label: "Collapse all",
    });
  });

  it("counts collapsed messages", () => {
    expect(collapsedCount(defaultExpanded(ids), ids)).toBe(2);
    expect(collapsedCount(expandAll(ids), ids)).toBe(0);
  });
});
