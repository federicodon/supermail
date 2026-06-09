import type { Email, SplitCategory, View } from "../types";

// Pure mailbox logic — kept free of React so it is unit-testable.

export const SPLIT_TABS: { key: SplitCategory; label: string }[] = [
  { key: "important", label: "Important" },
  { key: "other", label: "Other" },
  { key: "news", label: "News" },
  { key: "social", label: "Social" },
];

export function isSnoozed(email: Email, now: number): boolean {
  return !!email.snoozedUntil && new Date(email.snoozedUntil).getTime() > now;
}

// Spam folder membership = carries the local "Spam" label (set by markSpam).
export function isSpam(email: Email): boolean {
  return email.labels.includes("Spam");
}

// Visible inbox = not archived, not currently snoozed, not trashed, not spam,
// not muted. Trash and Spam are their own folders; trashed mail is excluded
// from every other view (Gmail behavior).
export function visibleForView(emails: Email[], view: View, now: number): Email[] {
  switch (view) {
    case "trash":
      return emails.filter((e) => e.trashed);
    case "spam":
      return emails.filter((e) => !e.trashed && isSpam(e));
    case "archive":
      return emails.filter((e) => e.archived && !e.trashed && !isSpam(e));
    case "snoozed":
      return emails.filter((e) => isSnoozed(e, now) && !e.trashed && !isSpam(e));
    case "starred":
      return emails.filter((e) => e.starred && !e.archived && !e.trashed && !isSpam(e));
    case "inbox":
    default:
      return emails.filter(
        (e) => !e.archived && !isSnoozed(e, now) && !e.trashed && !isSpam(e) && !e.muted
      );
  }
}

export function bySplit(emails: Email[], cat: SplitCategory): Email[] {
  return emails.filter((e) => e.category === cat);
}

export function unreadCount(emails: Email[], cat: SplitCategory, now: number): number {
  return emails.filter(
    (e) =>
      e.category === cat &&
      !e.read &&
      !e.archived &&
      !isSnoozed(e, now) &&
      !e.trashed &&
      !isSpam(e) &&
      !e.muted
  ).length;
}

// Full-text-ish search across the fields a power user expects.
export function searchEmails(emails: Email[], q: string): Email[] {
  const term = q.trim().toLowerCase();
  if (!term) return emails;
  return emails.filter((e) =>
    [e.subject, e.preview, e.body, e.from.name, e.from.email, e.from.company ?? "", ...e.labels]
      .join(" ")
      .toLowerCase()
      .includes(term)
  );
}

export const SNOOZE_PRESETS: { label: string; ms: number }[] = [
  { label: "Later today (+3h)", ms: 3 * 3600_000 },
  { label: "Tomorrow (+1d)", ms: 24 * 3600_000 },
  { label: "Next week (+7d)", ms: 7 * 24 * 3600_000 },
];

export function applySnooze(email: Email, ms: number, now: number): Email {
  return { ...email, snoozedUntil: new Date(now + ms).toISOString() };
}
