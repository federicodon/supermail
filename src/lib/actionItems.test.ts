import { describe, it, expect } from "vitest";
import { extractActionItems, actionKindMeta, actionItemsSummary } from "./actionItems";
import { email } from "./testEmail";

describe("extractActionItems", () => {
  it("detects an explicit request", () => {
    const items = extractActionItems([
      email({ body: "Hi there. Can you review the contract this week?" }),
    ]);
    expect(items).toHaveLength(1);
    // ends with "?" but a request pattern wins precedence over "question"
    expect(items[0].kind).toBe("request");
    expect(items[0].text).toContain("review the contract");
    expect(items[0].from).toBe("Dana Whitfield");
  });

  it("detects a deadline and prefers it over a plain request", () => {
    const items = extractActionItems([
      email({ body: "Please send the signed copy by Friday." }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("deadline");
  });

  it("detects a real question directed at you", () => {
    const items = extractActionItems([
      email({ body: "Quick one — what's your availability next week?" }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("question");
  });

  it("ignores pleasantries and rhetorical questions", () => {
    const items = extractActionItems([
      email({ body: "Hey! How are you? Hope you're well. Sounds good?" }),
    ]);
    expect(items).toHaveLength(0);
  });

  it("never reads a negated 'no action needed' footer as a to-do", () => {
    expect(extractActionItems([email({ body: "FYI — no action needed on this." })])).toHaveLength(0);
    expect(extractActionItems([email({ body: "Sharing for visibility. No reply required." })])).toHaveLength(0);
    expect(extractActionItems([email({ body: "Nothing needed from you here." })])).toHaveLength(0);
  });

  it("guards the causal 'due to' (not a deadline)", () => {
    const items = extractActionItems([
      email({ body: "The launch slipped due to a vendor delay. All good now." }),
    ]);
    expect(items).toHaveLength(0);
  });

  it("never extracts from our own outbound message", () => {
    const items = extractActionItems([
      email({ outbound: true, from: { name: "You", email: "me@example.com" }, body: "Can you confirm the budget?" }),
    ]);
    expect(items).toHaveLength(0);
  });

  it("scans only fresh text, not the quoted reply trail", () => {
    const body = [
      "Thanks, noted.",
      "",
      "On Mon, Dana wrote:",
      "> Can you send me the deck by Friday?",
      "> Please confirm the numbers.",
    ].join("\n");
    const items = extractActionItems([email({ body })]);
    expect(items).toHaveLength(0);
  });

  it("deduplicates the same ask repeated across messages", () => {
    const items = extractActionItems([
      email({ id: "m1", threadId: "t1", date: "2026-06-06T09:00:00.000Z", body: "Can you approve the invoice?" }),
      email({ id: "m2", threadId: "t1", date: "2026-06-06T10:00:00.000Z", body: "Can you approve the invoice?" }),
    ]);
    expect(items).toHaveLength(1);
  });

  it("orders by freshest message first and caps the list", () => {
    const msgs = Array.from({ length: 10 }, (_, i) =>
      email({
        id: `m${i}`,
        date: `2026-06-0${(i % 9) + 1}T09:00:00.000Z`,
        body: `Can you handle task number ${i} please?`,
      }),
    );
    const items = extractActionItems(msgs);
    expect(items).toHaveLength(6); // MAX_ITEMS
    // freshest first (day 09 = m8)
    expect(items[0].msgId).toBe("m8");
  });

  it("excludes the reader's own address even without the outbound flag", () => {
    const items = extractActionItems(
      [email({ from: { name: "Me", email: "boss@example.com" }, body: "Can you ship it today?" })],
      "boss@example.com",
    );
    expect(items).toHaveLength(0);
  });

  it("handles bullet-list asks", () => {
    const body = ["A few things:", "- Please review the PRD", "- Can you book the room?"].join("\n");
    const items = extractActionItems([email({ body })]);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.map((i) => i.text)).toContain("Please review the PRD");
  });
});

describe("actionKindMeta", () => {
  it("returns an icon + label per kind", () => {
    expect(actionKindMeta("deadline").icon).toBe("⏰");
    expect(actionKindMeta("question").label).toBe("Question");
    expect(actionKindMeta("request").icon).toBe("✅");
  });
});

describe("actionItemsSummary", () => {
  it("renders one bullet per item with the sender", () => {
    const items = extractActionItems([email({ body: "Can you review the contract?" })]);
    expect(actionItemsSummary(items)).toBe("• Can you review the contract? (Dana Whitfield)");
  });

  it("is empty for no items", () => {
    expect(actionItemsSummary([])).toBe("");
  });
});
