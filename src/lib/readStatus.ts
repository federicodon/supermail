import type { Email } from "../types";

// Read-status feed — "Sent & Seen".
//
// Mirrors Superhuman's read statuses and the live `get_read_status_feed` tool:
// a feed of read receipts for mail you've sent — who opened it, when, and on
// what device — newest first, with a `since` window, a `limit`, an optional
// single-thread filter, and an opaque pagination cursor.
//
// HONEST LIMITATION: Gmail's REST API does NOT expose message-open events, so a
// real feed requires a tracking backend (which SuperMail does not ship). Here we
// build the feed from the mailbox's own `openedByRecipientAt` field (set in mock
// data / by a future provider). The *device* is synthesized deterministically
// from the message id purely for display — the open time itself is real data,
// not invented. This keeps the shape identical to the live tool so swapping in a
// backend is a drop-in.

export type Device = "desktop" | "mobile" | "tablet";

export interface ReadEvent {
  id: string;
  messageId: string;
  threadId: string;
  subject: string;
  recipient: string; // who opened it (the message's primary recipient)
  sentAt: string; // ISO — when we sent the message
  openedAt: string; // ISO — when it was opened
  device: Device;
  awaitingReply: boolean; // opened but no inbound reply yet (great follow-up signal)
}

export interface ReadStatusQuery {
  since?: string; // ISO; default 24h before `now` (matches the live tool)
  limit?: number; // default 50, max 200
  threadId?: string; // restrict to one thread
  cursor?: string; // opaque pagination cursor (an offset here)
}

export interface ReadStatusFeed {
  events: ReadEvent[];
  nextCursor: string | null;
}

const DEVICES: Device[] = ["desktop", "mobile", "tablet"];

// Tiny stable string hash (FNV-1a) — deterministic device assignment.
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function deviceFor(messageId: string): Device {
  return DEVICES[hash(messageId) % DEVICES.length];
}

// Has an inbound (not-from-us) reply landed on this thread after we sent?
function hasReplyAfter(emails: Email[], threadId: string, sentAtIso: string): boolean {
  const sent = Date.parse(sentAtIso);
  return emails.some(
    (e) => e.threadId === threadId && !e.outbound && Date.parse(e.date) > sent
  );
}

// Build the full set of read events from the mailbox (newest open first).
// One event per opened outbound message.
export function buildReadEvents(emails: Email[]): ReadEvent[] {
  const events: ReadEvent[] = [];
  for (const e of emails) {
    if (!e.outbound || !e.openedByRecipientAt) continue;
    const recipient = e.to[0]?.email || e.to[0]?.name || "recipient";
    events.push({
      id: `read-${e.id}`,
      messageId: e.id,
      threadId: e.threadId,
      subject: e.subject,
      recipient,
      sentAt: e.date,
      openedAt: e.openedByRecipientAt,
      device: deviceFor(e.id),
      awaitingReply: !hasReplyAfter(emails, e.threadId, e.date),
    });
  }
  return events.sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
}

// Apply the query window/limit/cursor to a prebuilt event list (matches the
// live tool's filtering semantics).
export function readStatusFeed(
  events: ReadEvent[],
  query: ReadStatusQuery,
  now: number
): ReadStatusFeed {
  const since = query.since ? Date.parse(query.since) : now - 24 * 3600_000;
  const limit = Math.min(200, Math.max(1, query.limit ?? 50));
  const offset = query.cursor ? Math.max(0, parseInt(query.cursor, 10) || 0) : 0;

  let filtered = events.filter((e) => Date.parse(e.openedAt) >= since);
  if (query.threadId) filtered = filtered.filter((e) => e.threadId === query.threadId);

  const page = filtered.slice(offset, offset + limit);
  const nextCursor = offset + limit < filtered.length ? String(offset + limit) : null;
  return { events: page, nextCursor };
}

// Convenience: build + filter in one call.
export function getReadStatusFeed(
  emails: Email[],
  query: ReadStatusQuery,
  now: number
): ReadStatusFeed {
  return readStatusFeed(buildReadEvents(emails), query, now);
}

// Summary for a header: opened count vs total sent, and how many are awaiting a reply.
export interface ReadStatusSummary {
  sent: number;
  opened: number;
  awaitingReply: number;
  openRate: number; // 0..1
}

export function readStatusSummary(emails: Email[]): ReadStatusSummary {
  const sent = emails.filter((e) => e.outbound).length;
  const events = buildReadEvents(emails);
  const opened = events.length;
  const awaitingReply = events.filter((e) => e.awaitingReply).length;
  return { sent, opened, awaitingReply, openRate: sent ? opened / sent : 0 };
}

// Windows offered in the UI (and a label).
export interface FeedWindow {
  label: string;
  ms: number;
}
export const FEED_WINDOWS: FeedWindow[] = [
  { label: "24 hours", ms: 24 * 3600_000 },
  { label: "7 days", ms: 7 * 24 * 3600_000 },
  { label: "30 days", ms: 30 * 24 * 3600_000 },
];

export function deviceIcon(device: Device): string {
  return device === "mobile" ? "📱" : device === "tablet" ? "📲" : "💻";
}
