import type { Email } from "../types";

// Minimal email factory for tests.
export function email(over: Partial<Email> = {}): Email {
  return {
    id: over.id ?? "e1",
    threadId: over.threadId ?? "t1",
    accountId: over.accountId,
    from: over.from ?? { name: "Dana Whitfield", email: "dana@acme.io" },
    to: over.to ?? [{ name: "You", email: "me@example.com" }],
    subject: over.subject ?? "Hello",
    preview: over.preview ?? "preview",
    body: over.body ?? "body text",
    date: over.date ?? "2026-06-06T09:00:00.000Z",
    read: over.read ?? false,
    starred: over.starred ?? false,
    archived: over.archived ?? false,
    category: over.category ?? "important",
    labels: over.labels ?? [],
    attachments: over.attachments ?? [],
    snoozedUntil: over.snoozedUntil ?? null,
    trashed: over.trashed,
    trashedAt: over.trashedAt ?? null,
    muted: over.muted,
    pinned: over.pinned,
    splitOverride: over.splitOverride,
    reminderAt: over.reminderAt ?? null,
    remindIfNoReply: over.remindIfNoReply,
    outbound: over.outbound,
    openedByRecipientAt: over.openedByRecipientAt ?? null,
    autoArchiveSuggested: over.autoArchiveSuggested,
    cc: over.cc,
    listUnsubscribe: over.listUnsubscribe,
    listUnsubscribePost: over.listUnsubscribePost,
  };
}
