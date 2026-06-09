import { describe, it, expect } from "vitest";
import { extractCommitments, commitmentsSummary } from "./commitments";
import { email } from "./testEmail";

const out = (over = {}) =>
  email({ outbound: true, to: [{ name: "Jordan Lee", email: "jordan@prospect.io" }], ...over });

describe("extractCommitments", () => {
  it("detects an 'I'll …' promise in your outbound mail", () => {
    const items = extractCommitments([out({ body: "Thanks! I'll send over the deck tomorrow." })]);
    expect(items).toHaveLength(1);
    expect(items[0].text).toContain("send over the deck");
    expect(items[0].to).toBe("Jordan Lee");
  });

  it("flags a deadline when the promise names a time", () => {
    const items = extractCommitments([out({ body: "I'll have the contract back to you by Friday." })]);
    expect(items).toHaveLength(1);
    expect(items[0].hasDeadline).toBe(true);
  });

  it("leaves hasDeadline false for an open-ended promise", () => {
    const items = extractCommitments([out({ body: "I'll take a look and get back to you." })]);
    expect(items).toHaveLength(1);
    expect(items[0].hasDeadline).toBe(false);
  });

  it("catches a 'we'll …' / 'let me …' promise", () => {
    const we = extractCommitments([out({ body: "We'll spin up a sandbox for your team." })]);
    expect(we).toHaveLength(1);
    const letme = extractCommitments([out({ body: "Let me dig into the numbers this week." })]);
    expect(letme).toHaveLength(1);
    expect(letme[0].hasDeadline).toBe(true);
  });

  it("ignores 'let me know' — that's an ask back to them, not a promise", () => {
    const items = extractCommitments([out({ body: "Sounds great. Let me know what works for you." })]);
    expect(items).toHaveLength(0);
  });

  it("ignores a negated 'I won't be able to …'", () => {
    const items = extractCommitments([out({ body: "Apologies, I won't be able to join the call." })]);
    expect(items).toHaveLength(0);
  });

  it("ignores a question ('Shall I send it over?')", () => {
    const items = extractCommitments([out({ body: "Happy to help. Shall I send it over?" })]);
    expect(items).toHaveLength(0);
  });

  it("never reads an inbound message as your commitment", () => {
    // from someone else, not outbound — even with promise-like wording.
    const items = extractCommitments([
      email({ outbound: false, from: { name: "Dana", email: "dana@acme.io" }, body: "I'll review it." }),
    ]);
    expect(items).toHaveLength(0);
  });

  it("counts a message you authored via selfEmail even without the outbound flag", () => {
    const items = extractCommitments(
      [email({ from: { name: "Me", email: "me@self.io" }, body: "I'll circle back Monday." })],
      "me@self.io",
    );
    expect(items).toHaveLength(1);
  });

  it("ignores the quoted reply trail (only your fresh text counts)", () => {
    const items = extractCommitments([
      out({
        body: "Thanks for this.\n\nOn Mon, Dana wrote:\n> I'll send the report by Tuesday.",
      }),
    ]);
    expect(items).toHaveLength(0);
  });

  it("dedupes and caps, newest message first", () => {
    const msgs = Array.from({ length: 9 }, (_, i) =>
      out({ id: `m${i}`, date: `2026-06-0${i + 1}T09:00:00.000Z`, body: `I'll ship feature ${i}.` }),
    );
    const items = extractCommitments(msgs);
    expect(items).toHaveLength(6);
    // freshest first → feature 8 (latest date) leads
    expect(items[0].text).toContain("feature 8");
  });

  it("summarizes for the Ask panel", () => {
    const items = extractCommitments([out({ body: "I'll send the notes shortly." })]);
    expect(commitmentsSummary(items)).toContain("(to Jordan Lee)");
  });
});
