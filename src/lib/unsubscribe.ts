import type { BlockEntry, Email } from "../types";

// One-click Unsubscribe + sender/domain block list.
//
// Mirrors Superhuman's "Unsubscribe" affordance and the live `unsubscribe` tool:
// detect bulk / mailing-list mail via the RFC 2369 `List-Unsubscribe` header (or
// heuristics), then let the user unsubscribe — optionally trashing the thread
// and/or blocking the sender or their whole domain.
//
// SAFETY: in this build, unsubscribing NEVER contacts the sender. A real
// List-Unsubscribe action would either POST to a one-click URL (RFC 8058) or
// send a `mailto:`; SuperMail's hard send boundary forbids outbound mail, and we
// do not auto-POST to third-party URLs either. Instead we model the *outcome*
// locally: archive the thread, label it "Unsubscribed", and add a block rule so
// future mail from that sender is auto-archived. The parsed unsubscribe target is
// surfaced read-only so a human can act on it manually. `unsubscribePlan` carries
// an explicit `contactsSender: false` that the tests assert on.

export const UNSUBSCRIBED_LABEL = "Unsubscribed";
export const SPAM_LABEL = "Spam";

// ---- Parsing the List-Unsubscribe header ----------------------------------

export interface UnsubscribeTargets {
  http: string[];
  mailto: string[];
}

// Parse an RFC 2369 List-Unsubscribe header into its http(s) and mailto targets.
// The header is a comma-separated list of angle-bracketed URIs, e.g.
//   <https://list.example/u?id=9>, <mailto:unsub@example.com?subject=stop>
export function parseListUnsubscribe(header: string | undefined): UnsubscribeTargets {
  const http: string[] = [];
  const mailto: string[] = [];
  if (!header) return { http, mailto };
  const matches = header.match(/<([^>]+)>/g) ?? [];
  for (const m of matches) {
    const uri = m.slice(1, -1).trim();
    if (/^https?:/i.test(uri)) http.push(uri);
    else if (/^mailto:/i.test(uri)) mailto.push(uri);
  }
  return { http, mailto };
}

// The first usable unsubscribe target for display (prefers a one-click https URL).
export function unsubscribeTarget(email: Email): { kind: "http" | "mailto"; uri: string } | null {
  const { http, mailto } = parseListUnsubscribe(email.listUnsubscribe);
  if (http.length) return { kind: "http", uri: http[0] };
  if (mailto.length) return { kind: "mailto", uri: mailto[0] };
  return null;
}

// ---- Detecting bulk / list mail -------------------------------------------

const AUTOMATED_SENDER =
  /\b(no-?reply|do-?not-?reply|notifications?|digest|newsletter|news|updates?|info|hello|mailer|marketing|team|support)@/i;

// Is this message bulk / mailing-list mail (a good unsubscribe candidate)?
export function isBulkMail(email: Email): boolean {
  if (email.outbound) return false;
  if (email.listUnsubscribe) return true;
  if (email.category === "news" || email.category === "social") return true;
  if (AUTOMATED_SENDER.test(email.from.email)) return true;
  return /\bunsubscribe\b/i.test(email.body);
}

// Can we offer a one-click unsubscribe (a real target exists)? Even without a
// header we still allow "block sender" via the block list, but `hasUnsubscribe`
// gates the explicit unsubscribe button.
export function hasUnsubscribe(email: Email): boolean {
  return !!unsubscribeTarget(email) || /\bunsubscribe\b/i.test(email.body);
}

// ---- Block list ------------------------------------------------------------

export function senderDomain(email: Email): string {
  return (email.from.email.split("@")[1] ?? "").toLowerCase();
}

export function blockEntryFor(
  email: Email,
  scope: BlockEntry["scope"],
  reason: BlockEntry["reason"],
  nowIso: string
): BlockEntry {
  const value = scope === "domain" ? senderDomain(email) : email.from.email.toLowerCase();
  return { value, scope, reason, addedAt: nowIso };
}

// Add a block entry, de-duplicating on value (most recent reason/time wins).
export function addBlock(blocks: BlockEntry[], entry: BlockEntry): BlockEntry[] {
  if (!entry.value) return blocks;
  const rest = blocks.filter((b) => b.value !== entry.value);
  return [entry, ...rest];
}

export function removeBlock(blocks: BlockEntry[], value: string): BlockEntry[] {
  return blocks.filter((b) => b.value !== value.toLowerCase());
}

// Is a message from a blocked sender or domain?
export function isBlocked(email: Email, blocks: BlockEntry[]): boolean {
  if (email.outbound) return false;
  const addr = email.from.email.toLowerCase();
  const domain = senderDomain(email);
  return blocks.some((b) =>
    b.scope === "domain" ? domain === b.value : addr === b.value
  );
}

// Inbox messages that match a block rule — candidates for auto-archive.
export function blockedEmails(emails: Email[], blocks: BlockEntry[]): Email[] {
  if (!blocks.length) return [];
  return emails.filter((e) => !e.archived && isBlocked(e, blocks));
}

// ---- Unsubscribe plan (pure description of the local outcome) --------------

export interface UnsubscribeOptions {
  alsoTrash?: boolean; // remove the thread entirely
  alsoBlock?: boolean; // add a block rule for the sender
  alsoDomain?: boolean; // when blocking, block the whole domain instead of the address
}

export interface UnsubscribePlan {
  // What we will do locally:
  archive: boolean;
  addLabel: string;
  trash: boolean;
  block: BlockEntry | null;
  // The unsubscribe link/address we found, surfaced read-only for the human:
  target: { kind: "http" | "mailto"; uri: string } | null;
  // SAFETY INVARIANT — always false. Unsubscribing never sends mail or POSTs to
  // the sender's endpoint in this build; the human acts on `target` manually.
  contactsSender: false;
}

export function unsubscribePlan(
  email: Email,
  opts: UnsubscribeOptions,
  nowIso: string
): UnsubscribePlan {
  const block = opts.alsoBlock
    ? blockEntryFor(email, opts.alsoDomain ? "domain" : "sender", "unsubscribe", nowIso)
    : null;
  return {
    archive: !opts.alsoTrash, // trashing supersedes archiving
    addLabel: UNSUBSCRIBED_LABEL,
    trash: !!opts.alsoTrash,
    block,
    target: unsubscribeTarget(email),
    contactsSender: false,
  };
}

// Spam handling (mirrors `mark_spam`): label + archive + block the sender. Like
// unsubscribe, this is local-only and never reports to any provider.
export function spamPlan(email: Email, nowIso: string): UnsubscribePlan {
  return {
    archive: true,
    addLabel: SPAM_LABEL,
    trash: false,
    block: blockEntryFor(email, "sender", "spam", nowIso),
    target: null,
    contactsSender: false,
  };
}
