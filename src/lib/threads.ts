import type { Email } from "../types";

// Conversation threading.
//
// Superhuman (like Gmail) is conversation-centric: the list shows one row per
// thread, triage acts on the whole conversation, and opening a row reveals every
// message in order. This module turns a flat list of messages into threads and
// computes the summary the list row needs, with one shared implementation for
// the UI and the tests.

export interface Thread {
  id: string; // threadId
  messages: Email[]; // chronological, oldest -> newest
  latest: Email; // newest message — the row's representative
  subject: string;
  count: number;
  unreadCount: number;
  hasUnread: boolean;
  starred: boolean; // any message starred
  hasAttachment: boolean; // any message has an attachment
  participants: string[]; // unique inbound sender names, newest-first
  labels: string[]; // union across messages (SENT excluded)
  latestDate: string; // ISO of newest message
  reminderAt?: string | null; // from the latest message
  remindIfNoReply?: boolean;
  hasOutbound: boolean; // we sent at least one message in this thread
  pinned: boolean; // any message pinned — floats the thread to the top
  muted: boolean; // any message muted
}

function byDateAsc(a: Email, b: Email): number {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}

function summarize(id: string, chronological: Email[]): Thread {
  const latest = chronological[chronological.length - 1];
  const unreadCount = chronological.filter((m) => !m.read).length;

  // Participants: inbound senders, most-recent first, de-duplicated by name.
  const participants: string[] = [];
  for (let i = chronological.length - 1; i >= 0; i--) {
    const m = chronological[i];
    if (m.outbound) continue;
    if (!participants.includes(m.from.name)) participants.push(m.from.name);
  }
  if (participants.length === 0) participants.push(latest.from.name);

  const labels = [
    ...new Set(chronological.flatMap((m) => m.labels).filter((l) => l !== "SENT")),
  ];

  return {
    id,
    messages: chronological,
    latest,
    subject: latest.subject,
    count: chronological.length,
    unreadCount,
    hasUnread: unreadCount > 0,
    starred: chronological.some((m) => m.starred),
    hasAttachment: chronological.some((m) => m.attachments.length > 0),
    participants,
    labels,
    latestDate: latest.date,
    reminderAt: latest.reminderAt,
    remindIfNoReply: latest.remindIfNoReply,
    hasOutbound: chronological.some((m) => m.outbound),
    pinned: chronological.some((m) => m.pinned),
    muted: chronological.some((m) => m.muted),
  };
}

// Group messages into threads (newest-active first). Pass an already
// view-filtered list and the result is the set of threads to show.
export function groupThreads(emails: Email[]): Thread[] {
  const map = new Map<string, Email[]>();
  for (const e of emails) {
    const bucket = map.get(e.threadId);
    if (bucket) bucket.push(e);
    else map.set(e.threadId, [e]);
  }
  const threads: Thread[] = [];
  for (const [id, msgs] of map) {
    threads.push(summarize(id, msgs.slice().sort(byDateAsc)));
  }
  // Pinned conversations float to the top; otherwise newest-active first.
  return threads.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime();
  });
}

// The full thread (all messages, any state) for a given id — used when opening a
// conversation so archived/read history is visible even if the list was filtered.
export function threadById(emails: Email[], threadId: string): Thread | null {
  const msgs = emails.filter((e) => e.threadId === threadId);
  if (!msgs.length) return null;
  return summarize(threadId, msgs.slice().sort(byDateAsc));
}

// Compact "who's on this thread" label for a list row.
export function participantsLabel(thread: Thread): string {
  const names = thread.participants.map((n) => n.split(" ")[0]);
  if (names.length <= 2) return names.join(", ");
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

// Number of distinct threads with at least one unread message.
export function unreadThreadCount(emails: Email[]): number {
  return groupThreads(emails).filter((t) => t.hasUnread).length;
}
