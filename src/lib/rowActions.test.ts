import { describe, it, expect } from "vitest";
import { rowActions } from "./rowActions";

const ids = (row: { hasUnread: boolean; pinned: boolean }, view: Parameters<typeof rowActions>[1]) =>
  rowActions(row, view).map((a) => a.id);

describe("rowActions", () => {
  it("offers the core triage verbs on a normal inbox row", () => {
    expect(ids({ hasUnread: true, pinned: false }, "inbox")).toEqual([
      "archive",
      "snooze",
      "trash",
      "read",
      "pin",
    ]);
  });

  it("flips read<->unread and pin<->unpin with the row state", () => {
    expect(ids({ hasUnread: false, pinned: true }, "inbox")).toContain("unread");
    expect(ids({ hasUnread: false, pinned: true }, "inbox")).toContain("unpin");
    expect(ids({ hasUnread: false, pinned: true }, "inbox")).not.toContain("read");
    expect(ids({ hasUnread: false, pinned: true }, "inbox")).not.toContain("pin");
  });

  it("trash rows offer restore + delete-forever only", () => {
    expect(ids({ hasUnread: true, pinned: false }, "trash")).toEqual(["restore", "deleteForever"]);
  });

  it("spam rows offer not-spam + delete-forever only", () => {
    expect(ids({ hasUnread: true, pinned: false }, "spam")).toEqual(["notSpam", "deleteForever"]);
  });

  it("never offers a destructive purge outside trash/spam", () => {
    for (const v of ["inbox", "starred", "archive", "label", "search"] as const) {
      expect(ids({ hasUnread: true, pinned: false }, v)).not.toContain("deleteForever");
    }
  });

  it("every action carries a label and an icon", () => {
    for (const a of rowActions({ hasUnread: true, pinned: false }, "inbox")) {
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.icon.length).toBeGreaterThan(0);
    }
  });
});
