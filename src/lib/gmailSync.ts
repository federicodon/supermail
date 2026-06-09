import type { Email, Label } from "../types";

export interface GmailSyncStats {
  live: number;
  added: number;
  updated: number;
  unchanged: number;
  retained: number;
}

export interface GmailSyncResult {
  emails: Email[];
  stats: GmailSyncStats;
}

function preserveLocalState(live: Email, existing: Email | undefined, accountId: string): Email {
  if (!existing) return { ...live, accountId };
  return {
    ...live,
    accountId,
    snoozedUntil: existing.snoozedUntil ?? live.snoozedUntil,
    reminderAt: existing.reminderAt ?? live.reminderAt,
    remindIfNoReply: existing.remindIfNoReply ?? live.remindIfNoReply,
    reminderSetAt: existing.reminderSetAt ?? live.reminderSetAt,
    splitOverride: existing.splitOverride ?? live.splitOverride,
    openedByRecipientAt: existing.openedByRecipientAt ?? live.openedByRecipientAt,
    autoArchiveSuggested: existing.autoArchiveSuggested ?? live.autoArchiveSuggested,
  };
}

function sameOperationalSnapshot(a: Email | undefined, b: Email): boolean {
  if (!a) return false;
  return (
    a.subject === b.subject &&
    a.preview === b.preview &&
    a.body === b.body &&
    a.date === b.date &&
    a.read === b.read &&
    a.starred === b.starred &&
    a.archived === b.archived &&
    a.outbound === b.outbound &&
    JSON.stringify(a.labels) === JSON.stringify(b.labels) &&
    JSON.stringify(a.attachments) === JSON.stringify(b.attachments)
  );
}

export function mergeGmailSnapshot(current: Email[], live: Email[], accountId: string): GmailSyncResult {
  const currentById = new Map(current.map((e) => [e.id, e]));
  const liveIds = new Set(live.map((e) => e.id));
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  const mergedLive = live.map((e) => {
    const existing = currentById.get(e.id);
    if (!existing) added += 1;
    else if (sameOperationalSnapshot(existing, e)) unchanged += 1;
    else updated += 1;
    return preserveLocalState(e, existing, accountId);
  });

  const retained = current.filter((e) => e.accountId === accountId && !liveIds.has(e.id));
  const otherAccounts = current.filter((e) => e.accountId !== accountId);
  const emails = [...mergedLive, ...retained, ...otherAccounts].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date)
  );

  return {
    emails,
    stats: { live: live.length, added, updated, unchanged, retained: retained.length },
  };
}

export function gmailSyncSummary(stats: GmailSyncStats, accountEmail: string): string {
  const deltas = [
    `${stats.live} live`,
    stats.added ? `${stats.added} new` : "",
    stats.updated ? `${stats.updated} updated` : "",
    stats.retained ? `${stats.retained} retained` : "",
  ].filter(Boolean);
  return `Synced ${deltas.join(" · ")} from ${accountEmail}`;
}

export function mergeGmailLabels(current: Label[], gmailLabels: Label[]): Label[] {
  const byName = new Map(current.map((l) => [l.name.toLowerCase(), l]));
  const next = [...current];
  for (const label of gmailLabels) {
    const existing = byName.get(label.name.toLowerCase());
    if (existing) continue;
    next.push(label);
    byName.set(label.name.toLowerCase(), label);
  }
  return next;
}
