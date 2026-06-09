import type { Email } from "../types";
import { visibleForView } from "./mailbox";

// Multiple accounts / unified inbox (Superhuman-style).
//
// A power Gmail user usually lives in more than one mailbox — a work account and
// a personal one. SuperMail models several accounts and lets you scope every
// view to one of them or see them all together ("All inboxes"). Each message
// carries an `accountId`; older/untagged data falls back to the primary account.
//
// SAFETY: connecting *additional* real accounts is a documented, opt-in OAuth
// integration point. Nothing in this module sends mail, mutates a live account,
// or touches credentials — it only partitions the local mailbox by a tag.

export interface Account {
  id: string;
  name: string;
  email: string;
  // Accent color for the account's avatar chip in the switcher.
  color: string;
  // Per-account signature. When a string is present (even ""), it overrides the
  // global default signature for mail sent *from* this account; when undefined
  // the account falls back to the global signature. Lets a power user keep a
  // formal work sign-off and a breezy personal one. See signatureFor().
  signature?: string;
}

// Sentinel id for the unified "All inboxes" view.
export const ALL_ACCOUNTS = "all";

// The demo connects the authorized work account and a personal Gmail so the
// unified inbox + per-account scoping is demonstrable out of the box. Each ships
// its own signature so switching the "From" account in compose is visible.
export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: "work",
    name: "Growthcab",
    email: "federico.donatone@growthcab.com",
    color: "#7c5cff",
    signature: "Best,\nFederico Donatone\nGrowthcab",
  },
  {
    id: "personal",
    name: "Personal",
    email: "federicodonatone1@gmail.com",
    color: "#00d4a0",
    signature: "— Federico",
  },
];

// The account an untagged message belongs to (back-compat for older blobs).
export const PRIMARY_ACCOUNT_ID = DEFAULT_ACCOUNTS[0].id;

// Resolve an email's effective account id.
export function accountIdOf(email: Email): string {
  return email.accountId ?? PRIMARY_ACCOUNT_ID;
}

// Scope a mailbox to a single account, or pass everything through for "All".
export function filterByAccount(emails: Email[], accountId: string): Email[] {
  if (!accountId || accountId === ALL_ACCOUNTS) return emails;
  return emails.filter((e) => accountIdOf(e) === accountId);
}

export function accountById(accounts: Account[], id: string): Account | null {
  return accounts.find((a) => a.id === id) ?? null;
}

// Is `id` a real, known account (vs the "all" sentinel or a stale value)?
export function isKnownAccount(accounts: Account[], id: string): boolean {
  return id === ALL_ACCOUNTS || accounts.some((a) => a.id === id);
}

// Unread inbox count for an account — drives the switcher badge. Uses the same
// inbox-visibility rules as the rest of the app (archived/snoozed/trashed/spam/
// muted are all excluded), counting unread conversations by thread.
export function accountUnread(emails: Email[], accountId: string, now: number): number {
  const inbox = visibleForView(filterByAccount(emails, accountId), "inbox", now);
  const unreadThreads = new Set<string>();
  for (const e of inbox) {
    if (!e.read) unreadThreads.add(e.threadId);
  }
  return unreadThreads.size;
}

// Two-letter avatar initials for an account.
export function accountInitials(a: Account): string {
  const base = (a.name || a.email).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

// A short label for the current scope, e.g. "All inboxes" or "Growthcab".
export function accountScopeLabel(accounts: Account[], accountId: string): string {
  if (accountId === ALL_ACCOUNTS) return "All inboxes";
  return accountById(accounts, accountId)?.name ?? "All inboxes";
}

// ---- Compose identity (which account a new message is sent "from") ----------

// Pick the account a freshly-started compose should send from. Priority:
//   1. The account of the conversation being replied to / forwarded, when known
//      (you reply to a work thread *as* your work identity — Superhuman does this).
//   2. The active scope, when it's a single account (not the unified "All").
//   3. The primary (first) account as a safe default.
// Never returns the ALL_ACCOUNTS sentinel — a message always leaves from a real
// identity.
export function composeFromAccount(
  accounts: Account[],
  activeAccountId: string,
  replyAccountId?: string | null
): string {
  if (replyAccountId && isRealAccount(accounts, replyAccountId)) return replyAccountId;
  if (activeAccountId !== ALL_ACCOUNTS && isRealAccount(accounts, activeAccountId))
    return activeAccountId;
  return accounts[0]?.id ?? PRIMARY_ACCOUNT_ID;
}

// Is `id` a concrete account (excludes the "all" sentinel, unlike isKnownAccount)?
function isRealAccount(accounts: Account[], id: string): boolean {
  return id !== ALL_ACCOUNTS && accounts.some((a) => a.id === id);
}

// The signature to use for mail sent from `accountId`: the account's own
// signature when it defines one (an explicit "" means "no signature for this
// account"), otherwise the global fallback (Settings → Signature).
export function signatureFor(
  accounts: Account[],
  accountId: string | undefined | null,
  fallback: string
): string {
  const a = accountId ? accountById(accounts, accountId) : null;
  return a && typeof a.signature === "string" ? a.signature : fallback;
}

// "Name <email>" for the From row / sent-mail attribution.
export function fromIdentity(accounts: Account[], accountId: string | undefined | null): string {
  const a = accountId ? accountById(accounts, accountId) : null;
  if (!a) return "";
  return `${a.name} <${a.email}>`;
}

// Merge a persisted accounts list onto the defaults: keep the known set's shape
// but adopt any saved signature edits. Unknown saved ids are ignored so a stale
// blob can't resurrect a removed account. Falls back to defaults entirely when
// the saved value is missing or unusable.
export function resolveAccounts(saved?: Account[] | null): Account[] {
  if (!Array.isArray(saved) || saved.length === 0) return DEFAULT_ACCOUNTS;
  return DEFAULT_ACCOUNTS.map((base) => {
    const s = saved.find((x) => x && x.id === base.id);
    return s && typeof s.signature === "string" ? { ...base, signature: s.signature } : base;
  });
}
