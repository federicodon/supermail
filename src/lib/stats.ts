import type { Email, OutboxItem } from "../types";
import { visibleForView, isSpam, isSnoozed } from "./mailbox";
import { groupThreads } from "./threads";
import { autoArchiveCandidates, needsReplyCandidates } from "./ai";
import { reminderBuckets } from "./reminders";
import { readStatusSummary } from "./readStatus";
import { pending } from "./sendLater";

// Inbox-health / productivity dashboard.
//
// Superhuman markets "Get to Inbox Zero" and surfaces productivity stats. This is
// a deterministic, snapshot-based health model derived from the current mailbox
// (no analytics, nothing leaves the device). It powers the Stats view and the
// inbox-zero celebration.

export interface InboxStats {
  inbox: number; // visible inbox conversations
  unread: number; // inbox conversations with unread mail
  needsReply: number; // inbound unread asking a question / meeting
  awaitingReply: number; // mail you sent that hasn't been answered
  remindersDue: number;
  snoozed: number;
  scheduled: number; // queued send-later
  starred: number;
  spam: number;
  trash: number;
  archiveSuggestions: number;
  handled: number; // conversations cleared from the inbox (archived or trashed)
  total: number; // all non-trashed conversations
  clearedPct: number; // handled / total, 0..1
  openRate: number; // from the read-status feed, 0..1
  inboxZero: boolean;
  // A 0..100 "inbox health" score: 100 at inbox zero, dropping with backlog,
  // unread, things that need a reply and reminders past due.
  health: number;
}

function threadCount(emails: Email[]): number {
  return groupThreads(emails).length;
}

export function computeStats(emails: Email[], outbox: OutboxItem[], now: number): InboxStats {
  const inboxEmails = visibleForView(emails, "inbox", now);
  const inboxThreads = groupThreads(inboxEmails);
  const inbox = inboxThreads.length;
  const unread = inboxThreads.filter((t) => t.hasUnread).length;
  const needsReply = threadCount(needsReplyCandidates(emails));
  const reminders = reminderBuckets(emails, now);
  const read = readStatusSummary(emails);
  const starred = threadCount(emails.filter((e) => e.starred && !e.archived && !e.trashed && !isSpam(e)));
  const snoozed = threadCount(emails.filter((e) => isSnoozed(e, now) && !e.trashed));
  const spam = threadCount(emails.filter((e) => !e.trashed && isSpam(e)));
  const trash = threadCount(emails.filter((e) => e.trashed));
  const archiveSuggestions = autoArchiveCandidates(inboxEmails).length;

  const nonTrashed = emails.filter((e) => !e.trashed);
  const total = threadCount(nonTrashed);
  const handled = threadCount(nonTrashed.filter((e) => e.archived || isSpam(e)));
  const clearedPct = total ? handled / total : 1;

  // Health: start at 100 and subtract penalties, floored at 0.
  const penalty =
    inbox * 2 + unread * 2 + needsReply * 5 + reminders.due.length * 4 + Math.max(0, spam) * 1;
  const health = Math.max(0, Math.min(100, 100 - penalty));

  return {
    inbox,
    unread,
    needsReply,
    awaitingReply: read.awaitingReply,
    remindersDue: reminders.due.length,
    snoozed,
    scheduled: pending(outbox).length,
    starred,
    spam,
    trash,
    archiveSuggestions,
    handled,
    total,
    clearedPct,
    openRate: read.openRate,
    inboxZero: inbox === 0,
    health,
  };
}

// A short, prioritized list of "what to do next" derived from the stats. Each
// item names the count, a label and the view/action key the UI can route to.
export interface NextAction {
  key: string;
  count: number;
  label: string;
}

export function nextActions(s: InboxStats): NextAction[] {
  const out: NextAction[] = [];
  if (s.needsReply > 0) out.push({ key: "needsReply", count: s.needsReply, label: "need a reply from you" });
  if (s.remindersDue > 0) out.push({ key: "reminders", count: s.remindersDue, label: "reminders are due" });
  if (s.awaitingReply > 0) out.push({ key: "readstatus", count: s.awaitingReply, label: "opened, awaiting their reply" });
  if (s.archiveSuggestions > 0) out.push({ key: "archive", count: s.archiveSuggestions, label: "low-signal messages to archive" });
  if (s.unread > 0) out.push({ key: "unread", count: s.unread, label: "unread conversations" });
  return out;
}
