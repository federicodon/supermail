import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import { gmailSyncSummary, mergeGmailLabels, mergeGmailSnapshot } from "./gmailSync";

describe("gmail sync merge", () => {
  it("adds live Gmail messages and tags them with the connected account", () => {
    const result = mergeGmailSnapshot([], [email({ id: "g1", accountId: undefined })], "work");

    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].accountId).toBe("work");
    expect(result.stats).toEqual({ live: 1, added: 1, updated: 0, unchanged: 0, retained: 0 });
  });

  it("preserves local triage state across a live refresh", () => {
    const current = [
      email({
        id: "g1",
        accountId: "work",
        reminderAt: "2026-06-07T09:00:00.000Z",
        remindIfNoReply: true,
        splitOverride: "vip",
        openedByRecipientAt: "2026-06-06T10:00:00.000Z",
      }),
    ];
    const live = [email({ id: "g1", accountId: undefined, read: true, labels: ["Inbox"] })];

    const result = mergeGmailSnapshot(current, live, "work");

    expect(result.emails[0]).toMatchObject({
      accountId: "work",
      read: true,
      reminderAt: "2026-06-07T09:00:00.000Z",
      remindIfNoReply: true,
      splitOverride: "vip",
      openedByRecipientAt: "2026-06-06T10:00:00.000Z",
    });
    expect(result.stats.updated).toBe(1);
  });

  it("retains same-account mail missing from a partial Gmail snapshot", () => {
    const current = [
      email({ id: "older", accountId: "work", date: "2026-06-01T09:00:00.000Z" }),
      email({ id: "other-account", accountId: "personal", date: "2026-06-05T09:00:00.000Z" }),
    ];
    const live = [email({ id: "fresh", date: "2026-06-06T09:00:00.000Z" })];

    const result = mergeGmailSnapshot(current, live, "work");

    expect(result.emails.map((e) => e.id)).toEqual(["fresh", "other-account", "older"]);
    expect(result.stats.retained).toBe(1);
  });

  it("merges Gmail labels without duplicating existing local labels by name", () => {
    const labels = mergeGmailLabels(
      [{ id: "local-clients", name: "Clients", color: "#111" }],
      [
        { id: "gmail-Label_1", name: "clients", color: "#222" },
        { id: "gmail-Label_2", name: "Team", system: false },
      ]
    );

    expect(labels).toEqual([
      { id: "local-clients", name: "Clients", color: "#111" },
      { id: "gmail-Label_2", name: "Team", system: false },
    ]);
  });

  it("summarizes the sync result concisely", () => {
    expect(
      gmailSyncSummary(
        { live: 250, added: 12, updated: 4, unchanged: 234, retained: 17 },
        "federico.donatone@growthcab.com"
      )
    ).toBe("Synced 250 live · 12 new · 4 updated · 17 retained from federico.donatone@growthcab.com");
  });
});
