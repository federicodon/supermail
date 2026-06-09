import { describe, it, expect } from "vitest";
import {
  applyLiveSnapshot,
  upsertEmails,
  removeEmails,
  looksLikeMockMailbox,
} from "./liveSync";
import { email } from "./testEmail";

describe("applyLiveSnapshot", () => {
  it("replaces the mailbox with the live window, newest first", () => {
    const current = [email({ id: "m1" }), email({ id: "m2" })];
    const live = [
      email({ id: "g1", date: "2026-06-06T08:00:00.000Z" }),
      email({ id: "g2", date: "2026-06-06T10:00:00.000Z" }),
    ];
    const out = applyLiveSnapshot(current, live);
    expect(out.map((e) => e.id)).toEqual(["g2", "g1"]); // mock dropped, sorted desc
  });

  it("preserves local-only triage (snooze/reminder/pin/split) by id", () => {
    const current = [
      email({
        id: "g1",
        snoozedUntil: "2026-07-01T00:00:00.000Z",
        reminderAt: "2026-06-09T00:00:00.000Z",
        remindIfNoReply: true,
        pinned: true,
        splitOverride: "vip",
      }),
    ];
    // Live copy from Gmail has those fields null/absent.
    const live = [email({ id: "g1", read: true, snoozedUntil: null, reminderAt: null })];
    const [out] = applyLiveSnapshot(current, live);
    expect(out.snoozedUntil).toBe("2026-07-01T00:00:00.000Z");
    expect(out.reminderAt).toBe("2026-06-09T00:00:00.000Z");
    expect(out.remindIfNoReply).toBe(true);
    expect(out.pinned).toBe(true);
    expect(out.splitOverride).toBe("vip");
    // ...but Gmail-owned state wins (read flips through).
    expect(out.read).toBe(true);
  });

  it("lets Gmail win on read/starred/archived (the mirror)", () => {
    const current = [email({ id: "g1", read: false, starred: true, archived: false })];
    const live = [email({ id: "g1", read: true, starred: false, archived: true })];
    const [out] = applyLiveSnapshot(current, live);
    expect(out).toMatchObject({ read: true, starred: false, archived: true });
  });

  it("de-dupes by id defensively", () => {
    const live = [email({ id: "g1" }), email({ id: "g1" })];
    expect(applyLiveSnapshot([], live)).toHaveLength(1);
  });
});

describe("upsertEmails", () => {
  it("adds new mail and keeps the rest, newest first", () => {
    const current = [email({ id: "g1", date: "2026-06-06T08:00:00.000Z" })];
    const incoming = [email({ id: "g2", date: "2026-06-06T12:00:00.000Z" })];
    const out = upsertEmails(current, incoming);
    expect(out.map((e) => e.id)).toEqual(["g2", "g1"]);
  });

  it("replaces an existing message's Gmail state but keeps local overlays", () => {
    const current = [email({ id: "g1", read: false, snoozedUntil: "2026-07-01T00:00:00.000Z" })];
    const incoming = [email({ id: "g1", read: true, snoozedUntil: null })];
    const [out] = upsertEmails(current, incoming);
    expect(out.read).toBe(true);
    expect(out.snoozedUntil).toBe("2026-07-01T00:00:00.000Z");
  });

  it("returns the same array reference when nothing incoming", () => {
    const current = [email({ id: "g1" })];
    expect(upsertEmails(current, [])).toBe(current);
  });
});

describe("removeEmails", () => {
  it("drops expunged ids", () => {
    const current = [email({ id: "g1" }), email({ id: "g2" })];
    expect(removeEmails(current, ["g1"]).map((e) => e.id)).toEqual(["g2"]);
  });
  it("no-ops on empty id list", () => {
    const current = [email({ id: "g1" })];
    expect(removeEmails(current, [])).toBe(current);
  });
});

describe("looksLikeMockMailbox", () => {
  it("is true for empty and for short mock ids", () => {
    expect(looksLikeMockMailbox([])).toBe(true);
    expect(looksLikeMockMailbox([email({ id: "m1" }), email({ id: "t12" })])).toBe(true);
    expect(looksLikeMockMailbox([email({ id: "sent-1" })])).toBe(true);
  });
  it("is false once a real Gmail hex id is present", () => {
    expect(looksLikeMockMailbox([email({ id: "19e9da5244c859f5" })])).toBe(false);
  });
});
