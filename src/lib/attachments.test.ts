import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  extOf,
  attachmentKind,
  collectAttachments,
  filterAttachments,
  attachmentBreakdown,
} from "./attachments";

describe("attachment typing", () => {
  it("derives extensions and kinds", () => {
    expect(extOf("Q3-roadmap.PDF")).toBe("pdf");
    expect(extOf("noext")).toBe("");
    expect(attachmentKind("deck.pptx")).toBe("slide");
    expect(attachmentKind("photo.png")).toBe("image");
    expect(attachmentKind("budget.xlsx")).toBe("sheet");
    expect(attachmentKind("design.fig")).toBe("design");
    expect(attachmentKind("mystery.bin")).toBe("other");
  });
});

describe("collectAttachments", () => {
  const emails = [
    email({ id: "a", threadId: "t1", date: "2026-06-01T00:00:00.000Z", attachments: ["old.pdf"], from: { name: "Dana", email: "dana@x.com" } }),
    email({ id: "b", threadId: "t2", date: "2026-06-05T00:00:00.000Z", attachments: ["new.png", "deck.pptx"], from: { name: "Marcus Lee", email: "marcus@x.com" } }),
    email({ id: "c", threadId: "t3", attachments: ["secret.zip"], trashed: true }),
    email({ id: "d", threadId: "t4", attachments: [] }),
  ];

  it("flattens attachments newest-first and skips trashed + empty", () => {
    const list = collectAttachments(emails);
    expect(list.map((a) => a.filename)).toEqual(["new.png", "deck.pptx", "old.pdf"]);
    expect(list.find((a) => a.filename === "secret.zip")).toBeUndefined();
    expect(list[0].threadId).toBe("t2");
  });

  it("can include trashed when asked", () => {
    expect(collectAttachments(emails, { includeTrashed: true }).some((a) => a.filename === "secret.zip")).toBe(true);
  });

  it("filters by free text and by kind: operator", () => {
    const list = collectAttachments(emails);
    expect(filterAttachments(list, "png").map((a) => a.filename)).toEqual(["new.png"]);
    expect(filterAttachments(list, "kind:slide").map((a) => a.filename)).toEqual(["deck.pptx"]);
    expect(filterAttachments(list, "Dana").map((a) => a.filename)).toEqual(["old.pdf"]);
    expect(filterAttachments(list, "").length).toBe(3);
  });

  it("breaks down counts by kind", () => {
    const breakdown = attachmentBreakdown(collectAttachments(emails));
    const map = Object.fromEntries(breakdown.map((b) => [b.kind, b.count]));
    expect(map.image).toBe(1);
    expect(map.slide).toBe(1);
    expect(map.pdf).toBe(1);
  });
});
