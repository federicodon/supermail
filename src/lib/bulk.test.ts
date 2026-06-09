import { describe, it, expect } from "vitest";
import { markAllReadPlan, archiveReadPlan, archiveAllPlan } from "./bulk";
import type { Thread } from "./threads";

// Minimal thread stub — the planners only read id / hasUnread / pinned.
function t(id: string, hasUnread: boolean, pinned = false): Thread {
  return {
    id,
    messages: [],
    latest: {} as Thread["latest"],
    subject: id,
    count: 1,
    unreadCount: hasUnread ? 1 : 0,
    hasUnread,
    starred: false,
    hasAttachment: false,
    participants: [],
    labels: [],
    latestDate: "",
    hasOutbound: false,
    pinned,
    muted: false,
  };
}

const list = [t("a", true), t("b", false), t("c", true, true), t("d", false, true)];

describe("markAllReadPlan", () => {
  it("targets every unread thread, pinned included", () => {
    expect(markAllReadPlan(list)).toEqual({ ids: ["a", "c"], count: 2 });
  });
  it("is empty when nothing is unread", () => {
    expect(markAllReadPlan([t("b", false)])).toEqual({ ids: [], count: 0 });
  });
});

describe("archiveReadPlan", () => {
  it("clears read, non-pinned threads only (keeps unread + pinned)", () => {
    // a=unread (keep), b=read (clear), c=unread+pinned (keep), d=read+pinned (keep)
    expect(archiveReadPlan(list)).toEqual({ ids: ["b"], count: 1 });
  });
  it("never archives a pinned thread", () => {
    expect(archiveReadPlan([t("p", false, true)])).toEqual({ ids: [], count: 0 });
  });
});

describe("archiveAllPlan", () => {
  it("targets everything except pinned", () => {
    expect(archiveAllPlan(list)).toEqual({ ids: ["a", "b"], count: 2 });
  });
  it("preserves list order", () => {
    const ordered = [t("z", false), t("y", true), t("x", false)];
    expect(archiveAllPlan(ordered).ids).toEqual(["z", "y", "x"]);
  });
});
