import { describe, it, expect } from "vitest";
import { freshMockEmails } from "../data/mockMailbox";
import {
  visibleForView,
  bySplit,
  unreadCount,
  searchEmails,
  applySnooze,
  isSnoozed,
  isSpam,
} from "./mailbox";

const NOW = new Date("2026-06-06T09:00:00.000Z").getTime();

describe("mailbox logic", () => {
  it("seeds a realistic, mutation-safe mock mailbox", () => {
    const a = freshMockEmails();
    const b = freshMockEmails();
    expect(a.length).toBeGreaterThanOrEqual(10);
    // Clones are independent: mutating one snapshot never affects another.
    const originalRead = b[0].read;
    a[0].read = !a[0].read;
    a[0].labels.push("Mutated");
    expect(b[0].read).toBe(originalRead);
    expect(b[0].labels).not.toContain("Mutated");
  });

  it("inbox view hides archived and snoozed", () => {
    const emails = freshMockEmails();
    emails[0].archived = true;
    emails[1] = applySnooze(emails[1], 3600_000, NOW);
    const inbox = visibleForView(emails, "inbox", NOW);
    expect(inbox.find((e) => e.id === emails[0].id)).toBeUndefined();
    expect(inbox.find((e) => e.id === emails[1].id)).toBeUndefined();
  });

  it("snooze expires after its time", () => {
    const e = applySnooze(freshMockEmails()[0], 3600_000, NOW);
    expect(isSnoozed(e, NOW)).toBe(true);
    expect(isSnoozed(e, NOW + 2 * 3600_000)).toBe(false);
  });

  it("trash is its own folder and is hidden from every other view", () => {
    const emails = freshMockEmails();
    const victim = emails[0];
    victim.trashed = true;
    victim.starred = true; // even starred/archived trash stays out of those views
    victim.archived = true;
    for (const v of ["inbox", "starred", "archive", "snoozed", "spam"] as const) {
      expect(visibleForView(emails, v, NOW).some((e) => e.id === victim.id)).toBe(false);
    }
    expect(visibleForView(emails, "trash", NOW).some((e) => e.id === victim.id)).toBe(true);
  });

  it("spam is a folder driven by the local Spam label, out of the inbox", () => {
    const emails = freshMockEmails();
    const s = emails[1];
    s.labels = [...s.labels, "Spam"];
    expect(isSpam(s)).toBe(true);
    expect(visibleForView(emails, "inbox", NOW).some((e) => e.id === s.id)).toBe(false);
    expect(visibleForView(emails, "spam", NOW).some((e) => e.id === s.id)).toBe(true);
    // Trashing spam wins — it leaves the Spam folder for Trash.
    s.trashed = true;
    expect(visibleForView(emails, "spam", NOW).some((e) => e.id === s.id)).toBe(false);
    expect(visibleForView(emails, "trash", NOW).some((e) => e.id === s.id)).toBe(true);
  });

  it("muted conversations stay out of the inbox but remain elsewhere", () => {
    const emails = freshMockEmails();
    const m = emails.find((e) => !e.archived && !isSnoozed(e, NOW) && !e.trashed)!;
    m.muted = true;
    expect(visibleForView(emails, "inbox", NOW).some((e) => e.id === m.id)).toBe(false);
    // Not excluded from search / other folders.
    expect(searchEmails(emails, m.subject.split(" ")[0]).some((e) => e.id === m.id)).toBe(true);
  });

  it("splits emails into the four categories", () => {
    const emails = freshMockEmails();
    const important = bySplit(emails, "important");
    expect(important.length).toBeGreaterThan(0);
    expect(important.every((e) => e.category === "important")).toBe(true);
  });

  it("counts unread per split", () => {
    const emails = freshMockEmails();
    const before = unreadCount(emails, "important", NOW);
    expect(before).toBeGreaterThan(0);
    // Mark an actually-unread, visible important message read; count drops by one.
    const target = emails.find(
      (e) => e.category === "important" && !e.read && !e.archived && !isSnoozed(e, NOW)
    )!;
    target.read = true;
    expect(unreadCount(emails, "important", NOW)).toBe(before - 1);
  });

  it("searches across subject, sender, and body", () => {
    const emails = freshMockEmails();
    expect(searchEmails(emails, "oauth").length).toBeGreaterThan(0);
    expect(searchEmails(emails, "dana").length).toBeGreaterThan(0);
    expect(searchEmails(emails, "zzz-nomatch-zzz").length).toBe(0);
  });
});
