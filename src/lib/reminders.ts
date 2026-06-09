import type { Email } from "../types";

// Remind Me / Follow-up engine.
//
// Two flavours, matching Superhuman:
//  1. "Remind me" — resurface a thread at a chosen time no matter what.
//  2. "Remind me if no reply" — a follow-up safety net that only fires when the
//     other side hasn't replied. We model "replied" as an inbound message on the
//     same thread arriving any time after the reminder was *set* (the moment you
//     started waiting), not after it fires — so a reply that lands before the
//     follow-up's due time still cancels it. The cutoff is stored in
//     `reminderSetAt`; older reminders without it fall back to `reminderAt`.

export interface ReminderPreset {
  label: string;
  ms: number;
}

export const REMINDER_PRESETS: ReminderPreset[] = [
  { label: "In 2 hours", ms: 2 * 3600_000 },
  { label: "This evening (+6h)", ms: 6 * 3600_000 },
  { label: "Tomorrow morning (+20h)", ms: 20 * 3600_000 },
  { label: "In 2 days", ms: 2 * 24 * 3600_000 },
  { label: "Next week (+7d)", ms: 7 * 24 * 3600_000 },
];

export function setReminder(
  email: Email,
  ms: number,
  now: number,
  ifNoReply = false
): Email {
  return {
    ...email,
    reminderAt: new Date(now + ms).toISOString(),
    remindIfNoReply: ifNoReply,
    reminderSetAt: new Date(now).toISOString(),
  };
}

// Set a reminder at an absolute time. `setAtIso` records when you started
// waiting (the "if no reply" cutoff); defaults to the fire time for callers that
// don't track it, preserving the legacy behaviour.
export function setReminderAt(
  email: Email,
  iso: string,
  ifNoReply = false,
  setAtIso?: string
): Email {
  return {
    ...email,
    reminderAt: iso,
    remindIfNoReply: ifNoReply,
    reminderSetAt: setAtIso ?? null,
  };
}

export function clearReminder(email: Email): Email {
  return { ...email, reminderAt: null, remindIfNoReply: false, reminderSetAt: null };
}

// The cutoff a "remind me if no reply" follow-up measures replies against: when
// you started waiting (reminderSetAt), falling back to the fire time for legacy
// reminders that predate the field.
export function replyCutoff(email: Email): string | null {
  return email.reminderSetAt ?? email.reminderAt ?? null;
}

// Durations offered by the composer's "remind me if no reply" follow-up toggle.
export interface FollowUpPreset {
  label: string;
  ms: number;
}
export const FOLLOW_UP_PRESETS: FollowUpPreset[] = [
  { label: "in 1 day", ms: 24 * 3600_000 },
  { label: "in 2 days", ms: 2 * 24 * 3600_000 },
  { label: "in 3 days", ms: 3 * 24 * 3600_000 },
  { label: "in 1 week", ms: 7 * 24 * 3600_000 },
];
// Sensible default when the toggle is switched on (a typical follow-up window).
export const DEFAULT_FOLLOW_UP_MS = 3 * 24 * 3600_000;

export interface FollowUpArm {
  anchorId: string; // the message the reminder is attached to
  reminderAt: string; // ISO fire time
  reminderSetAt: string; // ISO cutoff (you start waiting when the reply goes out)
}

// Decide how to arm a no-reply follow-up after a reply actually leaves. The
// reminder anchors on the message you replied to (`inReplyTo`) — or, failing
// that, the latest message in the thread — fires `ms` from `now`, and measures
// replies from `now` (so any inbound message after your reply cancels it).
// Returns null when the thread can't be found (nothing to anchor to).
export function armFollowUp(
  emails: Email[],
  threadId: string,
  inReplyTo: string | null | undefined,
  ms: number,
  now: number
): FollowUpArm | null {
  const inThread = emails.filter((e) => e.threadId === threadId);
  if (inThread.length === 0) return null;
  const anchor =
    (inReplyTo ? inThread.find((e) => e.id === inReplyTo) : undefined) ??
    inThread.reduce((a, b) =>
      new Date(b.date).getTime() >= new Date(a.date).getTime() ? b : a
    );
  return {
    anchorId: anchor.id,
    reminderAt: new Date(now + ms).toISOString(),
    reminderSetAt: new Date(now).toISOString(),
  };
}

// Has the thread received an inbound (not-from-us) reply after `since`?
export function hasReplyAfter(
  emails: Email[],
  threadId: string,
  sinceIso: string
): boolean {
  const since = new Date(sinceIso).getTime();
  return emails.some(
    (e) =>
      e.threadId === threadId &&
      !e.outbound &&
      new Date(e.date).getTime() > since
  );
}

// Is a reminder currently due (and, for the "if no reply" variant, still unanswered)?
export function reminderDue(email: Email, emails: Email[], now: number): boolean {
  if (!email.reminderAt) return false;
  const due = new Date(email.reminderAt).getTime() <= now;
  if (!due) return false;
  if (email.remindIfNoReply) {
    // Only fire when no inbound reply landed after you started waiting. Measured
    // from reminderSetAt (when you set it), not the fire time — so a reply that
    // arrives before the follow-up is due still cancels it.
    const cutoff = replyCutoff(email);
    return cutoff ? !hasReplyAfter(emails, email.threadId, cutoff) : true;
  }
  return true;
}

// All reminders, split into due-now vs upcoming, sorted by time.
export function reminderBuckets(emails: Email[], now: number) {
  const withReminders = emails.filter((e) => e.reminderAt);
  const due = withReminders.filter((e) => reminderDue(e, emails, now));
  const upcoming = withReminders
    .filter((e) => !reminderDue(e, emails, now))
    .sort(
      (a, b) =>
        new Date(a.reminderAt!).getTime() - new Date(b.reminderAt!).getTime()
    );
  return { due, upcoming };
}

// Human label for when a reminder will fire.
export function reminderLabel(email: Email, now: number): string {
  if (!email.reminderAt) return "";
  const diff = new Date(email.reminderAt).getTime() - now;
  if (diff <= 0) return email.remindIfNoReply ? "Follow-up due" : "Reminder due";
  const hours = Math.round(diff / 3600_000);
  const when =
    hours < 24 ? `in ${hours}h` : `in ${Math.round(hours / 24)}d`;
  return email.remindIfNoReply ? `Follow up ${when} if no reply` : `Reminds ${when}`;
}
