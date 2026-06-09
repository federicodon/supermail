export type SplitCategory = "important" | "other" | "news" | "social";

export interface Contact {
  name: string;
  email: string;
  company?: string;
  role?: string;
  lastInteraction?: string;
}

export interface Email {
  id: string;
  threadId: string;
  // Which connected account this message belongs to (multi-account / unified
  // inbox). Optional for back-compat — untagged mail resolves to the primary
  // account. See src/lib/accounts.ts.
  accountId?: string;
  from: Contact;
  to: Contact[];
  cc?: Contact[];
  subject: string;
  preview: string;
  body: string;
  date: string; // ISO
  read: boolean;
  starred: boolean;
  archived: boolean;
  category: SplitCategory;
  labels: string[];
  attachments: string[];
  // Triage state
  snoozedUntil?: string | null; // ISO; if set, hidden until this time
  // Moved to Trash (Gmail TRASH). Excluded from every other view; restorable
  // from the Trash view. Auto-purge after 30 days is not simulated.
  trashed?: boolean;
  trashedAt?: string | null; // ISO; when it was deleted
  // Muted conversation (Gmail "mute"): kept out of the inbox even when new
  // messages arrive, until explicitly un-muted. Still searchable / in All Mail.
  muted?: boolean;
  // Pinned / focused conversation — floats to the top of the inbox list.
  pinned?: boolean;
  // Manual Split Inbox assignment (Superhuman "move to split"). When set, the
  // message lives *only* in this split id, overriding the rule-based matching;
  // null/undefined = follow the split rules. See src/lib/splitInbox.ts.
  splitOverride?: string | null;
  reminderAt?: string | null; // ISO; "remind me" follow-up
  // If true, the reminder only fires when no inbound reply has arrived
  // (Superhuman "remind me if no reply" safety net).
  remindIfNoReply?: boolean;
  // When the reminder was *set* (ISO). For the "if no reply" variant this is the
  // cutoff we measure "did they reply?" against — a reply landing any time after
  // you started waiting suppresses the follow-up, even if it arrives before the
  // reminder's fire time. Optional for back-compat (falls back to reminderAt).
  reminderSetAt?: string | null;
  // Direction: did *we* send this? Used for follow-up / read-status logic.
  outbound?: boolean;
  // Superhuman-style read receipt where provider permits (mock here).
  openedByRecipientAt?: string | null;
  // Set when AI/auto-rules suggest archiving; surfaced as a hint, not applied.
  autoArchiveSuggested?: boolean;
  // RFC 2369 List-Unsubscribe header value (if the sender is a mailing list),
  // e.g. "<https://list.example/u?id=9>, <mailto:unsub@example.com>". Drives the
  // one-click Unsubscribe affordance.
  listUnsubscribe?: string;
  // RFC 8058 "List-Unsubscribe-Post: List-Unsubscribe=One-Click" supported.
  listUnsubscribePost?: boolean;
}

// A blocked sender / domain entry (drives Unsubscribe + Block and auto-archive).
export interface BlockEntry {
  value: string; // lowercased email address or bare domain
  scope: "sender" | "domain";
  reason: "unsubscribe" | "manual" | "spam";
  addedAt: string; // ISO
}

export interface Snippet {
  id: string;
  name: string;
  shortcut: string; // e.g. ";intro"
  subject?: string;
  body: string;
}

// A saved search / smart view — a named query that runs across the mailbox,
// pinned in the sidebar (Superhuman-style saved searches).
export interface SavedSearch {
  id: string;
  name: string;
  query: string; // search.ts query language, e.g. "is:unread from:dana"
  icon?: string;
  pinned?: boolean;
  createdAt: string; // ISO
}

export interface Draft {
  id: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  threadId?: string | null;
  // Which connected account this message is sent *from* (multi-account). Drives
  // the From row and the per-account signature; resolves to the primary account
  // when absent. See src/lib/accounts.ts.
  fromAccountId?: string;
  // Scheduled send time (ISO). Null/undefined = send now.
  scheduledAt?: string | null;
  // "Remind me if no reply" armed from the composer: when set (a ms offset), a
  // follow-up reminder is placed on the conversation the moment this reply
  // actually goes out, firing this far in the future unless they reply first.
  // Null/undefined = no follow-up. See src/lib/reminders.ts (armFollowUp).
  followUpMs?: number | null;
}

// A message queued by "send later" or held during the undo-send window.
export interface OutboxItem {
  id: string;
  draft: Draft;
  // When the message is due to actually leave.
  sendAt: string; // ISO
  status: "scheduled" | "sending" | "sent" | "canceled";
  createdAt: string; // ISO
}

// Gmail-style label.
export interface Label {
  id: string;
  name: string; // may contain "/" for nesting, e.g. "Clients/Acme"
  color?: string;
  system?: boolean; // INBOX, STARRED… (not user-deletable)
}

// ---- Split Inbox ----
export type SplitRuleField =
  | "from"
  | "fromDomain"
  | "to"
  | "subject"
  | "body"
  | "label"
  | "category"
  | "hasAttachment"
  | "isUnread"
  | "isStarred";

export type SplitRuleOp = "contains" | "equals" | "is";

export interface SplitRule {
  field: SplitRuleField;
  op: SplitRuleOp;
  value: string; // for boolean fields, "true"/"false"
}

export interface SplitInbox {
  id: string;
  name: string;
  // How rules combine. "all" = AND, "any" = OR.
  match: "all" | "any";
  rules: SplitRule[];
  enabled: boolean;
  pinned?: boolean; // pinned splits render first / get focus
  builtin?: boolean; // from the default library
  icon?: string;
}

export type View =
  | "inbox"
  | "focus"
  | "today"
  | "snoozed"
  | "starred"
  | "archive"
  | "trash"
  | "spam"
  | "drafts"
  | "reminders"
  | "outbox"
  | "calendar"
  | "readstatus"
  | "people"
  | "stats"
  | "attachments"
  | "label"
  | "search"
  | "settings";

// A single keyboard action in the registry.
export interface ShortcutDef {
  id: string;
  keys: string[]; // e.g. ["e"], ["g", "i"] for a chord, ["mod+k"]
  label: string;
  group: string;
  // When true the action needs a currently-selected/open message.
  needsCurrent?: boolean;
}

// AI provider configuration result.
export interface AiAnswer {
  text: string;
  // Citations/source message ids when the answer references the inbox.
  sources?: string[];
  local: boolean; // true when produced by the deterministic fallback
}
