import type { Email, SplitInbox, SplitRule } from "../types";

// Split Inbox engine.
//
// Mirrors Superhuman's Split Inbox: the inbox is divided into independent,
// rule-driven lanes (a default set plus a library of presets plus fully custom
// rules). Each split is just a predicate over the message; this module owns the
// matching so the UI and tests share one implementation.

// Evaluate a single rule against an email.
export function matchRule(email: Email, rule: SplitRule): boolean {
  const has = (hay: string, needle: string) =>
    hay.toLowerCase().includes(needle.trim().toLowerCase());
  const v = rule.value ?? "";
  switch (rule.field) {
    case "from":
      return rule.op === "equals"
        ? email.from.email.toLowerCase() === v.toLowerCase()
        : has(`${email.from.name} ${email.from.email}`, v);
    case "fromDomain": {
      const domain = email.from.email.split("@")[1] ?? "";
      return rule.op === "equals"
        ? domain.toLowerCase() === v.toLowerCase().replace(/^@/, "")
        : has(domain, v.replace(/^@/, ""));
    }
    case "to":
      return email.to.some((t) => has(`${t.name} ${t.email}`, v));
    case "subject":
      return has(email.subject, v);
    case "body":
      return has(`${email.body} ${email.preview}`, v);
    case "label":
      return email.labels.some((l) =>
        rule.op === "equals" ? l.toLowerCase() === v.toLowerCase() : has(l, v)
      );
    case "category":
      return email.category === v;
    case "hasAttachment":
      return (email.attachments.length > 0) === (v !== "false");
    case "isUnread":
      return !email.read === (v !== "false");
    case "isStarred":
      return email.starred === (v !== "false");
    default:
      return false;
  }
}

// Does an email belong in a split?
//
// A *manual* assignment (Superhuman "move to split") wins over the rules and is
// exclusive: an overridden message appears only in its assigned split and is
// pulled out of every split it would otherwise match by rule. With no override
// the usual rule matching applies.
export function matchSplit(email: Email, split: SplitInbox): boolean {
  if (email.splitOverride != null) return email.splitOverride === split.id;
  if (!split.rules.length) return false;
  return split.match === "all"
    ? split.rules.every((r) => matchRule(email, r))
    : split.rules.some((r) => matchRule(email, r));
}

// Manually assign a message to a split (or clear with null → back to rules).
// Returns a new email (immutable); same reference when nothing changes.
export function assignSplit(email: Email, splitId: string | null): Email {
  const next = splitId ?? null;
  if ((email.splitOverride ?? null) === next) return email;
  return { ...email, splitOverride: next };
}

// Filter a list down to the messages in a split.
export function emailsInSplit(emails: Email[], split: SplitInbox): Email[] {
  return emails.filter((e) => matchSplit(e, split));
}

// Unread count for a split over a candidate list (already view-filtered).
export function splitUnreadCount(emails: Email[], split: SplitInbox): number {
  return emails.filter((e) => !e.read && matchSplit(e, split)).length;
}

// ---- Default splits (replicate Superhuman's default Important/Other/etc.) ----
export const DEFAULT_SPLITS: SplitInbox[] = [
  {
    id: "important",
    name: "Important",
    match: "any",
    rules: [{ field: "category", op: "is", value: "important" }],
    enabled: true,
    pinned: true,
    builtin: true,
    icon: "★",
  },
  {
    id: "other",
    name: "Other",
    match: "any",
    rules: [{ field: "category", op: "is", value: "other" }],
    enabled: true,
    builtin: true,
    icon: "•",
  },
  {
    id: "news",
    name: "News",
    match: "any",
    rules: [{ field: "category", op: "is", value: "news" }],
    enabled: true,
    builtin: true,
    icon: "📰",
  },
  {
    id: "social",
    name: "Social",
    match: "any",
    rules: [{ field: "category", op: "is", value: "social" }],
    enabled: true,
    builtin: true,
    icon: "👥",
  },
];

// ---- Library of additional split presets users can switch on. ----
export const SPLIT_LIBRARY: SplitInbox[] = [
  {
    id: "lib-vip",
    name: "VIP",
    match: "any",
    rules: [
      { field: "from", op: "contains", value: "acme.io" },
      { field: "from", op: "contains", value: "founderfund.vc" },
    ],
    enabled: false,
    builtin: true,
    icon: "💎",
  },
  {
    id: "lib-team",
    name: "Team",
    match: "any",
    rules: [{ field: "fromDomain", op: "contains", value: "northwind.dev" }],
    enabled: false,
    builtin: true,
    icon: "👤",
  },
  {
    id: "lib-calendar",
    name: "Calendar",
    match: "any",
    rules: [
      { field: "from", op: "contains", value: "calendar" },
      { field: "subject", op: "contains", value: "invite" },
      { field: "subject", op: "contains", value: "1:1" },
    ],
    enabled: false,
    builtin: true,
    icon: "📅",
  },
  {
    id: "lib-unread",
    name: "Unread",
    match: "all",
    rules: [{ field: "isUnread", op: "is", value: "true" }],
    enabled: false,
    builtin: true,
    icon: "●",
  },
  {
    id: "lib-starred",
    name: "Pinned",
    match: "all",
    rules: [{ field: "isStarred", op: "is", value: "true" }],
    enabled: false,
    builtin: true,
    icon: "📌",
  },
  {
    id: "lib-attachments",
    name: "Has files",
    match: "all",
    rules: [{ field: "hasAttachment", op: "is", value: "true" }],
    enabled: false,
    builtin: true,
    icon: "📎",
  },
  {
    id: "lib-receipts",
    name: "Receipts",
    match: "any",
    rules: [
      { field: "subject", op: "contains", value: "receipt" },
      { field: "subject", op: "contains", value: "invoice" },
      { field: "from", op: "contains", value: "stripe" },
    ],
    enabled: false,
    builtin: true,
    icon: "🧾",
  },
];

// Active, ordered splits for the inbox: pinned first, then declared order, only enabled.
export function activeSplits(splits: SplitInbox[]): SplitInbox[] {
  return splits
    .filter((s) => s.enabled)
    .slice()
    .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));
}

// "Other / everything else" catch list — messages not in any *enabled non-default* split.
// Used so nothing silently disappears when custom splits are active.
export function uncategorized(emails: Email[], splits: SplitInbox[]): Email[] {
  const active = activeSplits(splits);
  return emails.filter((e) => !active.some((s) => matchSplit(e, s)));
}

let customSeq = 0;
export function newCustomSplit(name: string): SplitInbox {
  customSeq += 1;
  return {
    id: `custom-${customSeq}`,
    name: name || `Split ${customSeq}`,
    match: "all",
    rules: [],
    enabled: true,
    builtin: false,
    icon: "▦",
  };
}
