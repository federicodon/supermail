import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import { computeStats, nextActions } from "./stats";

const NOW = new Date("2026-06-06T09:00:00.000Z").getTime();

describe("computeStats", () => {
  it("reports inbox zero on an empty/cleared mailbox", () => {
    const emails = [
      email({ id: "a", threadId: "ta", archived: true }),
      email({ id: "b", threadId: "tb", trashed: true }),
    ];
    const s = computeStats(emails, [], NOW);
    expect(s.inbox).toBe(0);
    expect(s.inboxZero).toBe(true);
    expect(s.health).toBe(100);
    expect(s.trash).toBe(1);
  });

  it("counts inbox, unread, needs-reply and lowers health", () => {
    const emails = [
      email({ id: "1", threadId: "t1", read: false, body: "Can you review by Friday?" }),
      email({ id: "2", threadId: "t2", read: true, body: "fyi only" }),
      email({ id: "3", threadId: "t3", read: false, body: "Let's find time to meet next week" }),
    ];
    const s = computeStats(emails, [], NOW);
    expect(s.inbox).toBe(3);
    expect(s.unread).toBe(2);
    expect(s.needsReply).toBe(2); // the review-by-Friday + the meeting ask
    expect(s.inboxZero).toBe(false);
    expect(s.health).toBeLessThan(100);
  });

  it("tracks cleared percentage and starred / snoozed buckets", () => {
    const emails = [
      email({ id: "1", threadId: "t1", archived: true }),
      email({ id: "2", threadId: "t2", starred: true }),
      email({ id: "3", threadId: "t3", snoozedUntil: new Date(NOW + 3600_000).toISOString() }),
    ];
    const s = computeStats(emails, [], NOW);
    expect(s.total).toBe(3);
    expect(s.handled).toBe(1); // the archived one
    expect(s.clearedPct).toBeCloseTo(1 / 3, 5);
    expect(s.starred).toBe(1);
    expect(s.snoozed).toBe(1);
  });

  it("health is clamped to the 0..100 range under heavy backlog", () => {
    const emails = Array.from({ length: 80 }, (_, i) =>
      email({ id: `e${i}`, threadId: `t${i}`, read: false, body: "Can you confirm?" })
    );
    const s = computeStats(emails, [], NOW);
    expect(s.health).toBe(0);
    expect(s.health).toBeGreaterThanOrEqual(0);
  });
});

describe("nextActions", () => {
  it("prioritizes needs-reply over unread and omits empties", () => {
    const emails = [
      email({ id: "1", threadId: "t1", read: false, body: "Can you review by Friday?" }),
      email({ id: "2", threadId: "t2", read: false, body: "newsletter" }),
    ];
    const actions = nextActions(computeStats(emails, [], NOW));
    expect(actions[0].key).toBe("needsReply");
    expect(actions.every((a) => a.count > 0)).toBe(true);
  });

  it("returns nothing to do at inbox zero", () => {
    const s = computeStats([email({ archived: true })], [], NOW);
    expect(nextActions(s)).toEqual([]);
  });
});
