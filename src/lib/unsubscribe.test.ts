import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  parseListUnsubscribe,
  unsubscribeTarget,
  isBulkMail,
  hasUnsubscribe,
  senderDomain,
  blockEntryFor,
  addBlock,
  removeBlock,
  isBlocked,
  blockedEmails,
  unsubscribePlan,
  spamPlan,
  UNSUBSCRIBED_LABEL,
  SPAM_LABEL,
} from "./unsubscribe";
import type { BlockEntry } from "../types";

const NOW = "2026-06-06T09:00:00.000Z";

describe("parseListUnsubscribe", () => {
  it("splits http and mailto targets", () => {
    const t = parseListUnsubscribe(
      "<https://list.example/u?id=9>, <mailto:unsub@example.com?subject=stop>"
    );
    expect(t.http).toEqual(["https://list.example/u?id=9"]);
    expect(t.mailto).toEqual(["mailto:unsub@example.com?subject=stop"]);
  });

  it("handles missing/blank headers", () => {
    expect(parseListUnsubscribe(undefined)).toEqual({ http: [], mailto: [] });
    expect(parseListUnsubscribe("")).toEqual({ http: [], mailto: [] });
  });

  it("prefers a one-click http target", () => {
    const e = email({ listUnsubscribe: "<mailto:a@b.com>, <https://x.io/u>" });
    expect(unsubscribeTarget(e)).toEqual({ kind: "http", uri: "https://x.io/u" });
  });

  it("falls back to mailto when no http target", () => {
    const e = email({ listUnsubscribe: "<mailto:a@b.com>" });
    expect(unsubscribeTarget(e)).toEqual({ kind: "mailto", uri: "mailto:a@b.com" });
  });
});

describe("bulk / unsubscribe detection", () => {
  it("flags list mail, news, social, and automated senders", () => {
    expect(isBulkMail(email({ listUnsubscribe: "<https://x/u>" }))).toBe(true);
    expect(isBulkMail(email({ category: "news" }))).toBe(true);
    expect(isBulkMail(email({ category: "social" }))).toBe(true);
    expect(
      isBulkMail(email({ category: "other", from: { name: "X", email: "no-reply@x.com" } }))
    ).toBe(true);
  });

  it("does not flag a normal person's mail or our own outbound", () => {
    expect(
      isBulkMail(email({ category: "important", from: { name: "Dana", email: "dana@acme.io" } }))
    ).toBe(false);
    expect(isBulkMail(email({ category: "news", outbound: true }))).toBe(false);
  });

  it("hasUnsubscribe is true for a header or a body mention", () => {
    expect(hasUnsubscribe(email({ listUnsubscribe: "<https://x/u>" }))).toBe(true);
    expect(hasUnsubscribe(email({ body: "Click here to unsubscribe." }))).toBe(true);
    expect(hasUnsubscribe(email({ body: "just a normal note" }))).toBe(false);
  });
});

describe("block list", () => {
  it("derives sender + domain entries", () => {
    const e = email({ from: { name: "News", email: "digest@news.example" } });
    expect(senderDomain(e)).toBe("news.example");
    expect(blockEntryFor(e, "sender", "manual", NOW)).toMatchObject({
      value: "digest@news.example",
      scope: "sender",
      reason: "manual",
    });
    expect(blockEntryFor(e, "domain", "spam", NOW).value).toBe("news.example");
  });

  it("adds/dedupes/removes immutably", () => {
    const a = addBlock([], blockEntryFor(email(), "sender", "manual", NOW));
    expect(a).toHaveLength(1);
    // Re-adding the same value replaces rather than duplicates.
    const b = addBlock(a, blockEntryFor(email(), "sender", "spam", NOW));
    expect(b).toHaveLength(1);
    expect(b[0].reason).toBe("spam");
    const c = removeBlock(b, "dana@acme.io");
    expect(c).toHaveLength(0);
    expect(b).toHaveLength(1); // original untouched
  });

  it("matches blocked senders and domains, never outbound", () => {
    const blocks: BlockEntry[] = [
      { value: "spam.example", scope: "domain", reason: "spam", addedAt: NOW },
      { value: "bad@actor.com", scope: "sender", reason: "manual", addedAt: NOW },
    ];
    expect(isBlocked(email({ from: { name: "X", email: "hi@spam.example" } }), blocks)).toBe(true);
    expect(isBlocked(email({ from: { name: "X", email: "bad@actor.com" } }), blocks)).toBe(true);
    expect(isBlocked(email({ from: { name: "X", email: "ok@actor.com" } }), blocks)).toBe(false);
    expect(
      isBlocked(email({ outbound: true, from: { name: "X", email: "bad@actor.com" } }), blocks)
    ).toBe(false);
  });

  it("collects blocked inbox messages for auto-archive", () => {
    const blocks: BlockEntry[] = [{ value: "x.com", scope: "domain", reason: "manual", addedAt: NOW }];
    const list = [
      email({ id: "a", from: { name: "X", email: "a@x.com" } }),
      email({ id: "b", from: { name: "X", email: "a@x.com" }, archived: true }),
      email({ id: "c", from: { name: "Y", email: "c@y.com" } }),
    ];
    expect(blockedEmails(list, blocks).map((e) => e.id)).toEqual(["a"]);
    expect(blockedEmails(list, [])).toEqual([]);
  });
});

describe("unsubscribe / spam plan (local-only, never contacts sender)", () => {
  const e = email({
    from: { name: "News", email: "digest@news.example" },
    listUnsubscribe: "<https://news.example/u?id=9>",
  });

  it("archives + labels and surfaces the target read-only", () => {
    const plan = unsubscribePlan(e, {}, NOW);
    expect(plan.archive).toBe(true);
    expect(plan.trash).toBe(false);
    expect(plan.addLabel).toBe(UNSUBSCRIBED_LABEL);
    expect(plan.block).toBeNull();
    expect(plan.target).toEqual({ kind: "http", uri: "https://news.example/u?id=9" });
    expect(plan.contactsSender).toBe(false);
  });

  it("trash supersedes archive; block sender vs domain", () => {
    const trashed = unsubscribePlan(e, { alsoTrash: true }, NOW);
    expect(trashed.trash).toBe(true);
    expect(trashed.archive).toBe(false);

    const sender = unsubscribePlan(e, { alsoBlock: true }, NOW);
    expect(sender.block).toMatchObject({ value: "digest@news.example", scope: "sender" });

    const domain = unsubscribePlan(e, { alsoBlock: true, alsoDomain: true }, NOW);
    expect(domain.block).toMatchObject({ value: "news.example", scope: "domain" });
  });

  it("spamPlan labels Spam, archives, blocks the sender, and never contacts them", () => {
    const plan = spamPlan(e, NOW);
    expect(plan.addLabel).toBe(SPAM_LABEL);
    expect(plan.archive).toBe(true);
    expect(plan.block).toMatchObject({ value: "digest@news.example", reason: "spam" });
    expect(plan.contactsSender).toBe(false);
  });
});
