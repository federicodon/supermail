import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  matchRule,
  matchSplit,
  assignSplit,
  emailsInSplit,
  splitUnreadCount,
  activeSplits,
  newCustomSplit,
  DEFAULT_SPLITS,
  SPLIT_LIBRARY,
} from "./splitInbox";
import type { SplitInbox } from "../types";

describe("matchRule", () => {
  it("matches sender domain, subject contains, and booleans", () => {
    const e = email({ from: { name: "Sam", email: "sam@acme.io" }, subject: "Q3 invite", starred: true, attachments: ["x.pdf"], read: false });
    expect(matchRule(e, { field: "fromDomain", op: "contains", value: "acme.io" })).toBe(true);
    expect(matchRule(e, { field: "fromDomain", op: "equals", value: "other.com" })).toBe(false);
    expect(matchRule(e, { field: "subject", op: "contains", value: "invite" })).toBe(true);
    expect(matchRule(e, { field: "isStarred", op: "is", value: "true" })).toBe(true);
    expect(matchRule(e, { field: "hasAttachment", op: "is", value: "true" })).toBe(true);
    expect(matchRule(e, { field: "isUnread", op: "is", value: "true" })).toBe(true);
  });

  it("matches category and label fields", () => {
    const e = email({ category: "news", labels: ["Clients/Acme"] });
    expect(matchRule(e, { field: "category", op: "is", value: "news" })).toBe(true);
    expect(matchRule(e, { field: "label", op: "contains", value: "acme" })).toBe(true);
    expect(matchRule(e, { field: "label", op: "equals", value: "clients/acme" })).toBe(true);
  });
});

describe("matchSplit (all vs any)", () => {
  const e = email({ category: "important", starred: true });
  it("AND requires every rule", () => {
    const split: SplitInbox = { id: "s", name: "S", match: "all", enabled: true, rules: [
      { field: "category", op: "is", value: "important" },
      { field: "isStarred", op: "is", value: "true" },
    ] };
    expect(matchSplit(e, split)).toBe(true);
    expect(matchSplit(email({ category: "important", starred: false }), split)).toBe(false);
  });
  it("OR requires any rule and empty rules never match", () => {
    const split: SplitInbox = { id: "s", name: "S", match: "any", enabled: true, rules: [
      { field: "category", op: "is", value: "news" },
      { field: "isStarred", op: "is", value: "true" },
    ] };
    expect(matchSplit(e, split)).toBe(true);
    expect(matchSplit(e, { ...split, rules: [] })).toBe(false);
  });
});

describe("manual move to split (override)", () => {
  const important = DEFAULT_SPLITS.find((s) => s.id === "important")!;
  const news = DEFAULT_SPLITS.find((s) => s.id === "news")!;

  it("assignSplit sets/clears immutably and no-ops when unchanged", () => {
    const e = email({ category: "important" });
    const moved = assignSplit(e, "news");
    expect(moved.splitOverride).toBe("news");
    expect(e.splitOverride ?? null).toBeNull(); // original untouched
    expect(assignSplit(moved, "news")).toBe(moved); // same ref, no change
    expect(assignSplit(moved, null).splitOverride).toBeNull();
  });

  it("an override wins over the rules and is exclusive", () => {
    // A rule-wise "important" message moved to news appears ONLY in news.
    const moved = assignSplit(email({ category: "important" }), "news");
    expect(matchSplit(moved, news)).toBe(true);
    expect(matchSplit(moved, important)).toBe(false);
  });

  it("clearing the override restores rule-based matching", () => {
    const e = assignSplit(assignSplit(email({ category: "important" }), "news"), null);
    expect(matchSplit(e, important)).toBe(true);
    expect(matchSplit(e, news)).toBe(false);
  });
});

describe("split aggregates", () => {
  const emails = [
    email({ id: "a", category: "important", read: false }),
    email({ id: "b", category: "important", read: true }),
    email({ id: "c", category: "news", read: false }),
  ];
  const important = DEFAULT_SPLITS.find((s) => s.id === "important")!;
  it("filters and counts unread per split", () => {
    expect(emailsInSplit(emails, important).map((e) => e.id)).toEqual(["a", "b"]);
    expect(splitUnreadCount(emails, important)).toBe(1);
  });
  it("activeSplits keeps enabled and pins first", () => {
    const mixed = [...DEFAULT_SPLITS, ...SPLIT_LIBRARY];
    const active = activeSplits(mixed);
    expect(active.every((s) => s.enabled)).toBe(true);
    expect(active[0].pinned).toBe(true); // Important is pinned
  });
  it("newCustomSplit is enabled, non-builtin, empty rules", () => {
    const c = newCustomSplit("VIP clients");
    expect(c.enabled).toBe(true);
    expect(c.builtin).toBe(false);
    expect(c.rules).toEqual([]);
    expect(c.name).toBe("VIP clients");
  });
});
