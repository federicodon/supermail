import type { Email } from "../types";
import { isSnoozed } from "./mailbox";
import { detectMeetingRequest } from "./meetingIntent";
import { extractActionItems } from "./actionItems";
import { extractCommitments } from "./commitments";
import { isBulkMail } from "./unsubscribe";

// `is:` values that are SuperMail-local virtual filters with no Gmail server
// equivalent — dropped from toGmailQuery so the REST adapter never emits them.
const LOCAL_IS_FILTERS = new Set([
  "meeting", "actionable", "ask", "committed", "promised",
  "newsletter", "bulk", "list",
]);

// Power-user search.
//
// A Gmail-style query language layered over the local mailbox: structured
// operators (from:, to:, cc:, subject:, label:, is:, has:, in:, category:,
// before:/after: and the Gmail-familiar newer_than:/older_than: aliases)
// combined with free text, all ANDed, with `-` negation and quoted phrases.
// `is:` covers unread/read/starred/snoozed/sent/reminded/pinned/muted. The same
// parse also maps to Gmail's `q` syntax so the REST adapter can run the
// identical query server-side.

export type QueryField =
  | "from"
  | "to"
  | "cc"
  | "subject"
  | "body"
  | "label"
  | "category"
  | "is"
  | "has"
  | "in"
  | "before"
  | "after"
  // Gmail-familiar relative-date aliases: newer_than:7d / older_than:1w.
  | "newer_than"
  | "older_than";

const FIELDS = new Set<string>([
  "from", "to", "cc", "subject", "body", "label", "category", "is", "has", "in",
  "before", "after", "newer_than", "older_than",
]);

export interface QueryFilter {
  field: QueryField;
  value: string;
  negated: boolean;
}

export interface ParsedQuery {
  filters: QueryFilter[];
  text: string[]; // free-text tokens (ANDed)
  raw: string;
}

const TOKEN_RE = /(-?[a-zA-Z_]+:"[^"]*")|(-?[a-zA-Z_]+:[^\s]+)|("[^"]*")|(\S+)/g;

function unquote(s: string): string {
  return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

// Parse a raw query string into structured filters + free text.
export function parseQuery(raw: string): ParsedQuery {
  const filters: QueryFilter[] = [];
  const text: string[] = [];
  const matches = raw.match(TOKEN_RE) ?? [];
  for (const token of matches) {
    let t = token;
    let negated = false;
    if (t.startsWith("-")) {
      negated = true;
      t = t.slice(1);
    }
    const colon = t.indexOf(":");
    const maybeField = colon > 0 ? t.slice(0, colon).toLowerCase() : "";
    if (maybeField && FIELDS.has(maybeField)) {
      const value = unquote(t.slice(colon + 1)).trim();
      if (value) filters.push({ field: maybeField as QueryField, value, negated });
    } else {
      const word = unquote(token.startsWith("-") ? token : token).trim();
      if (word) text.push(word.toLowerCase());
    }
  }
  return { filters, text, raw };
}

// ---- Date helpers ----------------------------------------------------------

// Parse an absolute (YYYY-MM-DD) or relative (Nd/Nw/Nh) date into ms epoch.
// Relative values are measured back from `now`.
export function parseDateValue(value: string, now: number): number | null {
  const rel = value.match(/^(\d+)\s*([dwh])$/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms = unit === "h" ? 3600_000 : unit === "w" ? 7 * 86_400_000 : 86_400_000;
    return now - n * ms;
  }
  const abs = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (abs) {
    const d = new Date(`${abs[1]}-${abs[2]}-${abs[3]}T00:00:00.000Z`).getTime();
    return Number.isNaN(d) ? null : d;
  }
  return null;
}

// ---- Matching --------------------------------------------------------------

function hay(...parts: string[]): string {
  return parts.join(" ").toLowerCase();
}

// A conservative URL detector for `has:link`: an explicit http(s) scheme or a
// `www.` prefix only. Deliberately does NOT match bare domains, so an email
// address ("dana@acme.io") or a stray "acme.io" mention never reads as a link.
const URL_RE = /\bhttps?:\/\/[^\s<>()]+|\bwww\.[^\s<>()]+/i;

export function hasLink(email: Email): boolean {
  return URL_RE.test(email.body) || URL_RE.test(email.preview);
}

function matchFilter(email: Email, f: QueryFilter, now: number): boolean {
  const v = f.value.toLowerCase();
  let result: boolean;
  switch (f.field) {
    case "from":
      result = hay(email.from.name, email.from.email, email.from.company ?? "").includes(v);
      break;
    case "to":
      result = email.to.some((t) => hay(t.name, t.email).includes(v));
      break;
    case "cc":
      result = (email.cc ?? []).some((t) => hay(t.name, t.email).includes(v));
      break;
    case "subject":
      result = email.subject.toLowerCase().includes(v);
      break;
    case "body":
      result = hay(email.body, email.preview).includes(v);
      break;
    case "label":
      result = email.labels.some((l) => l.toLowerCase().includes(v));
      break;
    case "category":
      result = email.category === v;
      break;
    case "has":
      if (v === "attachment" || v === "attachments" || v === "file") {
        result = email.attachments.length > 0;
      } else if (v === "link" || v === "links" || v === "url") {
        // SuperMail-local virtual filter: the message body contains a URL.
        result = hasLink(email);
      } else {
        result = false;
      }
      break;
    case "is":
      result = matchIs(email, v, now);
      break;
    case "in":
      result = matchIn(email, v, now);
      break;
    case "before":
    case "older_than": {
      const t = parseDateValue(f.value, now);
      result = t === null ? false : new Date(email.date).getTime() <= t;
      break;
    }
    case "after":
    case "newer_than": {
      const t = parseDateValue(f.value, now);
      result = t === null ? false : new Date(email.date).getTime() >= t;
      break;
    }
    default:
      result = false;
  }
  return f.negated ? !result : result;
}

function matchIs(email: Email, v: string, now: number): boolean {
  switch (v) {
    case "unread": return !email.read;
    case "read": return email.read;
    case "starred": return email.starred;
    case "unstarred": return !email.starred;
    case "snoozed": return isSnoozed(email, now);
    case "archived": case "done": return email.archived;
    case "sent": return !!email.outbound;
    case "reminded": return !!email.reminderAt;
    case "pinned": return !!email.pinned;
    case "muted": return !!email.muted;
    // SuperMail-local virtual filter: an inbound message that reads as a
    // scheduling request (see meetingIntent.ts). No Gmail equivalent.
    case "meeting": return detectMeetingRequest(email) !== null;
    // SuperMail-local virtual filter: an inbound message that asks something of
    // you — a deadline, request or direct question (see actionItems.ts).
    case "actionable": case "ask": return extractActionItems([email]).length > 0;
    // SuperMail-local virtual filter: an outbound message in which you made a
    // promise — a commitment you owe (see commitments.ts). No Gmail equivalent.
    case "committed": case "promised": return extractCommitments([email]).length > 0;
    // SuperMail-local virtual filter: bulk / mailing-list mail — anything carrying
    // a List-Unsubscribe header, a news/social category, an automated sender, or
    // an "unsubscribe" footer (see unsubscribe.ts). Lets you sweep newsletters in
    // one query. Gmail's nearest is category:promotions, which is narrower, so we
    // keep this local rather than mis-translate it.
    case "newsletter": case "bulk": case "list": return isBulkMail(email);
    default: return false;
  }
}

function matchIn(email: Email, v: string, now: number): boolean {
  switch (v) {
    case "inbox": return !email.archived && !isSnoozed(email, now);
    case "archive": case "done": return email.archived;
    case "snoozed": return isSnoozed(email, now);
    case "sent": return !!email.outbound;
    case "all": case "anywhere": return true;
    default: return false;
  }
}

function matchText(email: Email, token: string): boolean {
  return hay(
    email.subject,
    email.preview,
    email.body,
    email.from.name,
    email.from.email,
    email.from.company ?? "",
    ...email.to.map((t) => `${t.name} ${t.email}`),
    ...email.labels
  ).includes(token);
}

export function matchesQuery(email: Email, parsed: ParsedQuery, now: number): boolean {
  for (const f of parsed.filters) if (!matchFilter(email, f, now)) return false;
  for (const t of parsed.text) if (!matchText(email, t)) return false;
  return true;
}

// Filter a list with a raw query string. Empty query returns the list unchanged.
export function searchQuery(emails: Email[], raw: string, now: number): Email[] {
  if (!raw.trim()) return emails;
  const parsed = parseQuery(raw);
  return emails.filter((e) => matchesQuery(e, parsed, now));
}

// ---- Gmail `q` mapping -----------------------------------------------------

function toGmailDate(value: string, now: number): string | null {
  const t = parseDateValue(value, now);
  if (t === null) return null;
  const d = new Date(t);
  // Gmail expects YYYY/MM/DD.
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// Best-effort translation of a parsed query into Gmail search syntax so the REST
// adapter runs the same intent server-side.
export function toGmailQuery(parsed: ParsedQuery, now: number = 0): string {
  const parts: string[] = [];
  for (const f of parsed.filters) {
    const neg = f.negated ? "-" : "";
    const phrase = /\s/.test(f.value) ? `"${f.value}"` : f.value;
    switch (f.field) {
      case "from": parts.push(`${neg}from:${phrase}`); break;
      case "to": parts.push(`${neg}to:${phrase}`); break;
      case "cc": parts.push(`${neg}cc:${phrase}`); break;
      case "subject": parts.push(`${neg}subject:${phrase}`); break;
      case "label": parts.push(`${neg}label:${phrase}`); break;
      case "category": parts.push(`${neg}category:${phrase}`); break;
      // has:link is a SuperMail-local virtual filter (Gmail has no equivalent),
      // so drop it; every other has:* value maps to Gmail's has:attachment.
      case "has":
        if (!["link", "links", "url"].includes(f.value)) parts.push(`${neg}has:attachment`);
        break;
      // is:meeting / is:actionable are local-only virtual filters — Gmail has no
      // equivalent, so drop them rather than emit an operator Gmail rejects.
      case "is": if (!LOCAL_IS_FILTERS.has(f.value)) parts.push(`${neg}is:${phrase}`); break;
      case "in": parts.push(`${neg}in:${phrase}`); break;
      case "body": parts.push(`${neg}${phrase}`); break;
      case "before":
      case "older_than": {
        const d = toGmailDate(f.value, now);
        if (d) parts.push(`${neg}before:${d}`);
        break;
      }
      case "after":
      case "newer_than": {
        const d = toGmailDate(f.value, now);
        if (d) parts.push(`${neg}after:${d}`);
        break;
      }
    }
  }
  for (const t of parsed.text) parts.push(/\s/.test(t) ? `"${t}"` : t);
  return parts.join(" ").trim();
}

// Operators surfaced in the UI help / placeholder.
export const SEARCH_OPERATORS: { op: string; desc: string }[] = [
  { op: "from:dana", desc: "messages from a sender" },
  { op: "to:me", desc: "messages to someone" },
  { op: "cc:dana", desc: "messages copying someone (Cc)" },
  { op: "subject:roadmap", desc: "match the subject" },
  { op: 'subject:"q3 roadmap"', desc: "quote multi-word phrases" },
  { op: "label:Clients", desc: "messages with a label" },
  { op: "is:unread", desc: "unread / read / starred / sent / snoozed / pinned / muted" },
  { op: "is:meeting", desc: "scheduling requests (someone asking to meet)" },
  { op: "is:actionable", desc: "asks something of you (a deadline / request / question)" },
  { op: "is:committed", desc: "a promise you made in your sent mail" },
  { op: "is:newsletter", desc: "bulk / mailing-list mail (also is:bulk / is:list)" },
  { op: "has:attachment", desc: "has a file" },
  { op: "has:link", desc: "contains a URL (also has:url)" },
  { op: "in:archive", desc: "inbox / archive / snoozed / sent / all" },
  { op: "category:news", desc: "important / other / news / social" },
  { op: "newer_than:7d", desc: "newer than Nd/Nw/Nh (Gmail-style; also after:)" },
  { op: "older_than:2w", desc: "older than a span or date (also before:)" },
  { op: "before:2026-06-01", desc: "older than an absolute date" },
  { op: "-from:linkedin", desc: "negate any operator with -" },
];
