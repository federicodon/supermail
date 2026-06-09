import { describe, it, expect } from "vitest";
import { email } from "./testEmail";
import {
  setReminder,
  setReminderAt,
  clearReminder,
  hasReplyAfter,
  reminderDue,
  reminderBuckets,
  reminderLabel,
  replyCutoff,
  armFollowUp,
  FOLLOW_UP_PRESETS,
  DEFAULT_FOLLOW_UP_MS,
} from "./reminders";

const NOW = new Date("2026-06-06T09:00:00.000Z").getTime();

describe("reminders", () => {
  it("setReminder stores an absolute time and the if-no-reply flag", () => {
    const e = setReminder(email(), 2 * 3600_000, NOW, true);
    expect(e.remindIfNoReply).toBe(true);
    expect(new Date(e.reminderAt!).getTime()).toBe(NOW + 2 * 3600_000);
  });

  it("clearReminder removes both fields", () => {
    const e = clearReminder(setReminderAt(email(), new Date(NOW).toISOString(), true));
    expect(e.reminderAt).toBeNull();
    expect(e.remindIfNoReply).toBe(false);
  });

  it("plain reminder is due once its time passes", () => {
    const past = setReminderAt(email(), new Date(NOW - 1000).toISOString());
    const future = setReminderAt(email(), new Date(NOW + 1000).toISOString());
    expect(reminderDue(past, [past], NOW)).toBe(true);
    expect(reminderDue(future, [future], NOW)).toBe(false);
  });

  it("if-no-reply reminder fires only when no inbound reply arrived after it", () => {
    const setAt = new Date(NOW - 3600_000).toISOString();
    // The original message predates the reminder being set.
    const base = setReminderAt(email({ threadId: "t9", date: new Date(NOW - 2 * 3600_000).toISOString() }), setAt, true);
    // No reply yet -> due.
    expect(reminderDue(base, [base], NOW)).toBe(true);
    // Inbound reply after the reminder -> NOT due (they answered).
    const reply = email({ id: "r", threadId: "t9", outbound: false, date: new Date(NOW - 1800_000).toISOString() });
    expect(reminderDue(base, [base, reply], NOW)).toBe(false);
    // Our own outbound message does not count as "their reply".
    const mine = email({ id: "m", threadId: "t9", outbound: true, date: new Date(NOW - 1800_000).toISOString() });
    expect(reminderDue(base, [base, mine], NOW)).toBe(true);
  });

  it("setReminder records when it was set (the no-reply cutoff)", () => {
    const e = setReminder(email({ threadId: "tz" }), 3 * 24 * 3600_000, NOW, true);
    expect(e.reminderSetAt).toBe(new Date(NOW).toISOString());
    expect(replyCutoff(e)).toBe(new Date(NOW).toISOString());
  });

  it("if-no-reply measures from when it was SET, not when it fires", () => {
    // Set now to fire in 3 days. The bug: a reply arriving tomorrow (before the
    // fire time) used to slip through because the cutoff was the future fire time.
    const fireIn3d = NOW + 3 * 24 * 3600_000;
    const e = setReminder(email({ threadId: "tt" }), 3 * 24 * 3600_000, NOW, true);
    const replyNextDay = email({
      id: "rep",
      threadId: "tt",
      outbound: false,
      date: new Date(NOW + 24 * 3600_000).toISOString(),
    });
    // At fire time, they replied a day in → follow-up is cancelled.
    expect(reminderDue(e, [e, replyNextDay], fireIn3d)).toBe(false);
    // …but with no reply it still fires.
    expect(reminderDue(e, [e], fireIn3d)).toBe(true);
  });

  it("rescheduling resets the cutoff so an old reply no longer suppresses it", () => {
    // A reply came in at T0; later you reschedule (reset cutoff to T1 > reply).
    const t0Reply = email({
      id: "old",
      threadId: "tr",
      outbound: false,
      date: new Date(NOW - 2 * 3600_000).toISOString(),
    });
    const rescheduled = setReminderAt(
      // The thread you're following up on predates the reminder (as it always does).
      email({ threadId: "tr", date: new Date(NOW - 3 * 3600_000).toISOString() }),
      new Date(NOW + 1000).toISOString(),
      true,
      new Date(NOW - 1000).toISOString() // set-time AFTER the old reply
    );
    expect(reminderDue(rescheduled, [rescheduled, t0Reply], NOW + 2000)).toBe(true);
  });

  it("legacy reminders without reminderSetAt fall back to the fire time", () => {
    // setReminderAt without a set-time leaves reminderSetAt null → cutoff = fire time.
    const legacy = setReminderAt(
      email({ threadId: "tl", date: new Date(NOW - 2 * 3600_000).toISOString() }),
      new Date(NOW - 3600_000).toISOString(),
      true
    );
    expect(legacy.reminderSetAt).toBeNull();
    expect(replyCutoff(legacy)).toBe(new Date(NOW - 3600_000).toISOString());
    // No reply after the (fallback) cutoff → still fires.
    expect(reminderDue(legacy, [legacy], NOW)).toBe(true);
    // Inbound reply after it → suppressed.
    const reply = email({ id: "r2", threadId: "tl", outbound: false, date: new Date(NOW - 1800_000).toISOString() });
    expect(reminderDue(legacy, [legacy, reply], NOW)).toBe(false);
  });

  it("clearReminder removes the set-time too", () => {
    const e = clearReminder(setReminder(email(), 1000, NOW, true));
    expect(e.reminderSetAt).toBeNull();
  });

  it("hasReplyAfter only counts inbound messages strictly after the cutoff", () => {
    const before = email({ id: "b", threadId: "t", outbound: false, date: new Date(NOW - 10).toISOString() });
    const after = email({ id: "a", threadId: "t", outbound: false, date: new Date(NOW + 10).toISOString() });
    expect(hasReplyAfter([before], "t", new Date(NOW).toISOString())).toBe(false);
    expect(hasReplyAfter([after], "t", new Date(NOW).toISOString())).toBe(true);
  });

  it("buckets split due vs upcoming and sorts upcoming ascending", () => {
    const due = setReminderAt(email({ id: "d" }), new Date(NOW - 1000).toISOString());
    const soon = setReminderAt(email({ id: "s" }), new Date(NOW + 1000).toISOString());
    const later = setReminderAt(email({ id: "l" }), new Date(NOW + 5000).toISOString());
    const { due: d, upcoming } = reminderBuckets([later, due, soon], NOW);
    expect(d.map((e) => e.id)).toEqual(["d"]);
    expect(upcoming.map((e) => e.id)).toEqual(["s", "l"]);
  });

  it("armFollowUp anchors on the message you replied to and arms an if-no-reply reminder", () => {
    const orig = email({ id: "in", threadId: "tf", outbound: false, date: new Date(NOW - 3600_000).toISOString() });
    const sentReply = email({ id: "out", threadId: "tf", outbound: true, date: new Date(NOW).toISOString() });
    const arm = armFollowUp([orig, sentReply], "tf", "in", DEFAULT_FOLLOW_UP_MS, NOW);
    expect(arm).not.toBeNull();
    expect(arm!.anchorId).toBe("in");
    expect(arm!.reminderAt).toBe(new Date(NOW + DEFAULT_FOLLOW_UP_MS).toISOString());
    expect(arm!.reminderSetAt).toBe(new Date(NOW).toISOString());
    // Apply it and confirm the engine treats it as an unanswered follow-up.
    const armed = setReminderAt(orig, arm!.reminderAt, true, arm!.reminderSetAt);
    expect(reminderDue(armed, [armed, sentReply], NOW + DEFAULT_FOLLOW_UP_MS)).toBe(true); // your own reply doesn't count
    const theirReply = email({ id: "rep", threadId: "tf", outbound: false, date: new Date(NOW + 3600_000).toISOString() });
    expect(reminderDue(armed, [armed, sentReply, theirReply], NOW + DEFAULT_FOLLOW_UP_MS)).toBe(false);
  });

  it("armFollowUp falls back to the latest message when inReplyTo is unknown, and returns null for an empty thread", () => {
    const a = email({ id: "a", threadId: "tg", date: new Date(NOW - 7200_000).toISOString() });
    const b = email({ id: "b", threadId: "tg", date: new Date(NOW - 60_000).toISOString() });
    expect(armFollowUp([a, b], "tg", "ghost", 1000, NOW)!.anchorId).toBe("b");
    expect(armFollowUp([a, b], "missing-thread", "a", 1000, NOW)).toBeNull();
  });

  it("FOLLOW_UP_PRESETS are ascending and include the default", () => {
    const ms = FOLLOW_UP_PRESETS.map((p) => p.ms);
    expect(ms).toEqual([...ms].sort((x, y) => x - y));
    expect(ms).toContain(DEFAULT_FOLLOW_UP_MS);
  });

  it("reminderLabel describes timing and the follow-up variant", () => {
    const soon = setReminderAt(email(), new Date(NOW + 3 * 3600_000).toISOString());
    expect(reminderLabel(soon, NOW)).toMatch(/Reminds in 3h/);
    const fu = setReminderAt(email(), new Date(NOW + 2 * 24 * 3600_000).toISOString(), true);
    expect(reminderLabel(fu, NOW)).toMatch(/if no reply/);
  });
});
