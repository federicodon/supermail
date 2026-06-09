// Pure merge layer for live Gmail sync (snapshot + incremental stream).
//
// The mailbox (`Email[]`) is mirrored from Gmail, which is the source of truth
// for message existence, content and *Gmail-owned* state (read / starred /
// archived / trashed). SuperMail-only triage that Gmail has no concept of
// (snooze, reminder, follow-up, manual split, pin) is preserved across every
// sync by id — so a re-sync never wipes a snooze you set locally, but reading a
// mail in Gmail still flips it to read here.
//
// All functions are pure and id-keyed, so they're identical whether the source
// is the one-off snapshot or the always-on IMAP bridge.

import type { Email } from "../types";

export interface LiveSnapshot {
  account: string;
  emails: Email[];
  labels?: { id: string; name: string; color?: string; system?: boolean }[];
  generatedAt?: string;
  source?: string;
}

// Local-only fields Gmail can't represent — carried over from the prior copy of
// the same message so a sync never clobbers them. (read/starred/archived/trashed
// are deliberately NOT here: Gmail wins, that's the point of the mirror.)
const LOCAL_OVERLAY_FIELDS = [
  "snoozedUntil",
  "reminderAt",
  "remindIfNoReply",
  "reminderSetAt",
  "splitOverride",
  "pinned",
  "openedByRecipientAt",
  "autoArchiveSuggested",
] as const;

function withOverlay(live: Email, prev: Email | undefined): Email {
  if (!prev) return live;
  const merged: Email = { ...live };
  for (const f of LOCAL_OVERLAY_FIELDS) {
    const prevVal = prev[f];
    if (prevVal !== undefined && prevVal !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (merged as any)[f] = prevVal;
    }
  }
  return merged;
}

function byDateDesc(a: Email, b: Email): number {
  return Date.parse(b.date) - Date.parse(a.date);
}

// Replace the mailbox with the live window, carrying local overlays for any
// message that survives. Used on (re)connect and full refreshes. Anything not in
// the live window (e.g. leftover mock seed) is dropped — the mirror is the truth.
export function applyLiveSnapshot(current: Email[], live: Email[]): Email[] {
  const prevById = new Map(current.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const out: Email[] = [];
  for (const e of live) {
    if (seen.has(e.id)) continue; // de-dupe defensively
    seen.add(e.id);
    out.push(withOverlay(e, prevById.get(e.id)));
  }
  return out.sort(byDateDesc);
}

// Merge incoming messages (new mail or updated state) into the current mailbox
// by id, preserving local overlays. New ids are added; existing ids replaced.
export function upsertEmails(current: Email[], incoming: Email[]): Email[] {
  if (!incoming.length) return current;
  const map = new Map(current.map((e) => [e.id, e]));
  for (const e of incoming) {
    map.set(e.id, withOverlay(e, map.get(e.id)));
  }
  return [...map.values()].sort(byDateDesc);
}

// Drop messages that were expunged/trashed remotely.
export function removeEmails(current: Email[], ids: string[]): Email[] {
  if (!ids.length) return current;
  const gone = new Set(ids);
  return current.filter((e) => !gone.has(e.id));
}

// True when the current mailbox still looks like the bundled demo seed (mock ids
// are short like "m1"/"t1"; Gmail ids are long hex). Lets the app decide whether
// a first live sync should fully replace vs. merge.
export function looksLikeMockMailbox(emails: Email[]): boolean {
  if (!emails.length) return true;
  return emails.every((e) => /^[a-z]+\d+$|^sent-\d+$|^draft-/i.test(e.id));
}
