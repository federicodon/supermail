import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  buildReadEvents,
  readStatusFeed,
  getReadStatusFeed,
  readStatusSummary,
  deviceFor,
  deviceIcon,
} from "./readStatus";

const NOW = new Date("2026-06-06T09:00:00.000Z").getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

// A small sent/received fixture.
const emails = [
  email({
    id: "s1",
    threadId: "t1",
    outbound: true,
    subject: "Proposal",
    to: [{ name: "Dana", email: "dana@acme.io" }],
    date: hoursAgo(50),
    openedByRecipientAt: hoursAgo(48),
  }),
  email({
    id: "s2",
    threadId: "t2",
    outbound: true,
    subject: "Pilot recap",
    to: [{ name: "Jordan", email: "jordan@brightpath.co" }],
    date: hoursAgo(20),
    openedByRecipientAt: hoursAgo(2),
  }),
  // outbound but not opened -> no event
  email({ id: "s3", threadId: "t3", outbound: true, date: hoursAgo(5), openedByRecipientAt: null }),
  // inbound reply on t2 AFTER we sent -> s2 not awaiting reply
  email({ id: "r2", threadId: "t2", outbound: false, date: hoursAgo(1) }),
  // a normal inbound message -> never an event
  email({ id: "i1", threadId: "t9", outbound: false, openedByRecipientAt: null }),
];

describe("buildReadEvents", () => {
  it("creates one event per opened outbound message, newest first", () => {
    const events = buildReadEvents(emails);
    expect(events.map((e) => e.messageId)).toEqual(["s2", "s1"]); // s2 opened more recently
    expect(events[0]).toMatchObject({ subject: "Pilot recap", recipient: "jordan@brightpath.co" });
  });

  it("marks awaitingReply based on inbound replies after send", () => {
    const events = buildReadEvents(emails);
    const s1 = events.find((e) => e.messageId === "s1")!;
    const s2 = events.find((e) => e.messageId === "s2")!;
    expect(s1.awaitingReply).toBe(true); // no reply on t1
    expect(s2.awaitingReply).toBe(false); // r2 replied after send
  });

  it("ignores inbound mail and unopened outbound", () => {
    const ids = buildReadEvents(emails).map((e) => e.messageId);
    expect(ids).not.toContain("s3");
    expect(ids).not.toContain("i1");
  });
});

describe("readStatusFeed windowing", () => {
  it("defaults to a 24h window", () => {
    const feed = getReadStatusFeed(emails, {}, NOW);
    expect(feed.events.map((e) => e.messageId)).toEqual(["s2"]); // only s2 opened in last 24h
  });

  it("honors an explicit since window", () => {
    const feed = getReadStatusFeed(emails, { since: hoursAgo(72) }, NOW);
    expect(feed.events.map((e) => e.messageId)).toEqual(["s2", "s1"]);
  });

  it("filters by thread", () => {
    const feed = getReadStatusFeed(emails, { since: hoursAgo(72), threadId: "t1" }, NOW);
    expect(feed.events.map((e) => e.messageId)).toEqual(["s1"]);
  });

  it("paginates with a cursor", () => {
    const all = buildReadEvents(emails);
    const first = readStatusFeed(all, { since: hoursAgo(72), limit: 1 }, NOW);
    expect(first.events).toHaveLength(1);
    expect(first.nextCursor).toBe("1");
    const second = readStatusFeed(all, { since: hoursAgo(72), limit: 1, cursor: first.nextCursor! }, NOW);
    expect(second.events).toHaveLength(1);
    expect(second.events[0].messageId).not.toBe(first.events[0].messageId);
    expect(second.nextCursor).toBeNull();
  });
});

describe("summary + helpers", () => {
  it("summarizes sent / opened / awaiting", () => {
    const s = readStatusSummary(emails);
    expect(s.sent).toBe(3); // s1, s2, s3
    expect(s.opened).toBe(2); // s1, s2
    expect(s.awaitingReply).toBe(1); // s1
    expect(s.openRate).toBeCloseTo(2 / 3, 5);
  });

  it("device assignment is deterministic and labeled", () => {
    expect(deviceFor("s1")).toBe(deviceFor("s1"));
    expect(["💻", "📱", "📲"]).toContain(deviceIcon(deviceFor("s2")));
  });
});
