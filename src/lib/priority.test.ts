import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import { groupThreads } from "./threads";
import {
  threadPriority,
  isAttentionWorthy,
  rankByPriority,
  focusThreads,
  FOCUS_THRESHOLD,
} from "./priority";

const me = { name: "You", email: "me@example.com" };
const dana = { name: "Dana", email: "dana@acme.io" };

// Helper: a single-message thread from one email override.
const thread = (over: Parameters<typeof email>[0]) => groupThreads([email(over)])[0];

describe("threadPriority", () => {
  it("scores unread human mail with a direct ask highly", () => {
    const t = thread({ from: dana, to: [me], read: false, body: "Can you review the deck?" });
    const r = threadPriority(t);
    expect(r.score).toBeGreaterThanOrEqual(FOCUS_THRESHOLD);
    expect(r.reasons).toContain("Unread");
    expect(r.reasons).toContain("Awaiting your reply");
    expect(r.reasons).toContain("Direct ask");
  });

  it("treats a scheduling request as a distinct, higher-priority ask", () => {
    const meetingT = thread({ from: dana, to: [me], read: true, body: "Are you free Thursday for a quick call?" });
    const r = threadPriority(meetingT);
    expect(r.reasons).toContain("Scheduling request");
    expect(r.reasons).not.toContain("Direct ask"); // mutually exclusive — never double-counted
    // ranks above a generic direct ask, all else equal
    const askT = thread({ from: dana, to: [me], read: true, body: "Can you review the deck?" });
    expect(r.score).toBeGreaterThan(threadPriority(askT).score);
  });

  it("does not flag your own outbound scheduling message", () => {
    const t = thread({ from: me, to: [dana], outbound: true, read: true, body: "Are you free Thursday for a call?" });
    expect(threadPriority(t).reasons).not.toContain("Scheduling request");
  });

  it("deprioritizes bulk / newsletter mail", () => {
    const t = thread({
      from: { name: "News", email: "news@list.io" },
      to: [me],
      read: false,
      category: "news",
      listUnsubscribe: "<https://list.io/u/9>",
      body: "This week in tech",
    });
    expect(isAttentionWorthy(t)).toBe(false);
  });

  it("deprioritizes a thread where you replied last", () => {
    const t = thread({ from: me, to: [dana], outbound: true, read: true, body: "Sent you the file." });
    const r = threadPriority(t);
    expect(r.score).toBeLessThan(FOCUS_THRESHOLD);
    expect(r.reasons).not.toContain("Awaiting your reply");
  });

  it("muted conversations score zero", () => {
    const t = thread({ from: dana, to: [me], read: false, muted: true, body: "Can you?" });
    expect(threadPriority(t).score).toBe(0);
  });

  it("a VIP sender boosts the score and is cited", () => {
    const base = thread({ from: dana, to: [me], read: true, body: "fyi" });
    const vip = new Set(["dana@acme.io"]);
    const boosted = threadPriority(base, vip);
    expect(boosted.score).toBeGreaterThan(threadPriority(base).score);
    expect(boosted.reasons).toContain("VIP sender");
  });

  it("a recent message gets a recency nudge over an old one", () => {
    const now = Date.parse("2026-06-06T12:00:00Z");
    const fresh = thread({ id: "f", from: dana, to: [me], read: true, date: "2026-06-06T09:00:00Z", body: "fyi" });
    const old = thread({ id: "o", from: dana, to: [me], read: true, date: "2026-05-01T09:00:00Z", body: "fyi" });
    expect(threadPriority(fresh, undefined, now).score).toBeGreaterThan(
      threadPriority(old, undefined, now).score
    );
  });
});

describe("ranking + focus", () => {
  it("rankByPriority orders most-important first", () => {
    const urgent = thread({ id: "a", threadId: "a", from: dana, to: [me], read: false, body: "Can you approve today?" });
    const calm = thread({ id: "b", threadId: "b", from: me, to: [dana], outbound: true, read: true, body: "done" });
    const ranked = rankByPriority([calm, urgent]);
    expect(ranked[0].id).toBe("a");
  });

  it("focusThreads keeps only attention-worthy threads, ranked", () => {
    const ask = email({ id: "a", threadId: "a", from: dana, to: [me], read: false, body: "Can you send it?" });
    const news = email({
      id: "b",
      threadId: "b",
      from: { name: "News", email: "n@list.io" },
      to: [me],
      read: false,
      category: "news",
      listUnsubscribe: "<https://list.io/u>",
      body: "digest",
    });
    const replied = email({ id: "c", threadId: "c", from: me, to: [dana], outbound: true, read: true, body: "ok" });
    const threads = groupThreads([ask, news, replied]);
    const focus = focusThreads(threads);
    expect(focus.map((t) => t.id)).toEqual(["a"]);
  });
});
