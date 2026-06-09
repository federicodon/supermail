import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  groupThreads,
  threadById,
  participantsLabel,
  unreadThreadCount,
} from "./threads";

const T = [
  email({ id: "a1", threadId: "t1", from: { name: "Dana Whitfield", email: "dana@acme.io" }, date: "2026-06-01T09:00:00Z", read: true, subject: "Q3 roadmap" }),
  email({ id: "a2", threadId: "t1", from: { name: "You", email: "me@x.com" }, outbound: true, date: "2026-06-02T09:00:00Z", read: true, subject: "Re: Q3 roadmap" }),
  email({ id: "a3", threadId: "t1", from: { name: "Dana Whitfield", email: "dana@acme.io" }, date: "2026-06-03T09:00:00Z", read: false, subject: "Re: Q3 roadmap", starred: true, attachments: ["x.pdf"], labels: ["Clients"] }),
  email({ id: "b1", threadId: "t2", from: { name: "Marcus Lee", email: "marcus@nw.dev" }, date: "2026-06-04T09:00:00Z", read: false, subject: "Pairing?" }),
];

describe("groupThreads", () => {
  it("groups by threadId and orders messages chronologically", () => {
    const threads = groupThreads(T);
    const t1 = threads.find((t) => t.id === "t1")!;
    expect(t1.count).toBe(3);
    expect(t1.messages.map((m) => m.id)).toEqual(["a1", "a2", "a3"]);
    expect(t1.latest.id).toBe("a3");
  });

  it("orders threads by most-recent activity first", () => {
    const threads = groupThreads(T);
    expect(threads.map((t) => t.id)).toEqual(["t2", "t1"]); // b1 (Jun 4) is newest
  });

  it("aggregates unread / starred / attachment / labels across the thread", () => {
    const t1 = groupThreads(T).find((t) => t.id === "t1")!;
    expect(t1.unreadCount).toBe(1);
    expect(t1.hasUnread).toBe(true);
    expect(t1.starred).toBe(true);
    expect(t1.hasAttachment).toBe(true);
    expect(t1.labels).toContain("Clients");
    expect(t1.hasOutbound).toBe(true);
  });

  it("lists inbound participants newest-first, excluding us", () => {
    const t1 = groupThreads(T).find((t) => t.id === "t1")!;
    expect(t1.participants).toEqual(["Dana Whitfield"]);
    expect(participantsLabel(t1)).toBe("Dana");
  });
});

describe("threadById", () => {
  it("returns the full thread regardless of filtering", () => {
    const t = threadById(T, "t1")!;
    expect(t.count).toBe(3);
    expect(threadById(T, "nope")).toBeNull();
  });
});

describe("unreadThreadCount", () => {
  it("counts distinct threads with any unread message", () => {
    expect(unreadThreadCount(T)).toBe(2); // t1 (a3 unread) + t2 (b1 unread)
  });
});
