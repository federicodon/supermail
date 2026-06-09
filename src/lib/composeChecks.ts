// Pre-send guardrails for the composer — the small, high-value safety checks a
// power-mail client runs the instant you hit Send: no recipient, a malformed
// address, an empty subject or body, and the classic "you said 'attached' but
// nothing is attached" (Gmail's forgot-the-attachment nudge).
//
// Pure and deterministic — no React, no I/O. The composer runs `composeChecks`
// on every send attempt; a `block`-level result genuinely can't proceed (no
// recipient), while `warn`-level results show a "Send anyway?" confirmation so
// the guardrail never becomes a jail. SuperMail drafts are review-only and
// don't carry files, so the attachment nudge always points you back to Gmail to
// attach before sending.

import type { Draft } from "../types";
import { splitQuoted } from "./quotedText";

export type CheckLevel = "block" | "warn";

export interface ComposeCheck {
  // Stable identifier (used as a React key + for tests).
  code:
    | "no-recipient"
    | "invalid-recipient"
    | "invalid-cc"
    | "no-subject"
    | "no-body"
    | "forgot-attachment"
    | "many-recipients"
    | "placeholder";
  level: CheckLevel;
  message: string;
}

// Visible-audience size that trips the "large group" nudge (To + Cc). Chosen so
// it stays quiet for ordinary mail but catches an accidental mass-send / a
// reply-all to a big thread, where Bcc is usually the right tool.
export const MANY_RECIPIENTS = 8;

// A pragmatic address sanity check — enough to catch a typo ("dana", "dana@",
// "dana@growthcab") without pretending to be a full RFC 5322 validator.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Split a recipient field ("a@x.com, b@y.com; c@z.com") into trimmed entries.
export function parseRecipients(field: string | undefined): string[] {
  return (field ?? "")
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Pull the address out of a "Display Name <addr@host>" entry, else the entry.
function extractEmail(entry: string): string {
  const m = entry.match(/<([^>]+)>/);
  return (m ? m[1] : entry).trim();
}

// The recipient entries that don't look like valid email addresses.
export function invalidRecipients(field: string | undefined): string[] {
  return parseRecipients(field).filter((r) => !EMAIL_RE.test(extractEmail(r)));
}

// Unambiguous "a file is coming" phrases. High precision on purpose: SuperMail
// drafts can't hold files, so every match nudges the human — we'd rather miss a
// rare phrasing than cry wolf on "I'm attached to this idea" or "attachment
// style". A bare "attached"/"attachment" is deliberately NOT a trigger.
const ATTACH_PHRASES = [
  "see attached",
  "see the attached",
  "please see attached",
  "find attached",
  "please find attached",
  "attached please find",
  "attached you",        // "attached you'll find…"
  "attached is",
  "attached are",
  "attached herewith",
  "the attached",
  "i attached",
  "i've attached",
  "i have attached",
  "we attached",
  "we've attached",
  "we have attached",
  "have attached the",
  "i'm attaching",
  "i am attaching",
  "we're attaching",
  "attaching the",
  "attaching a",
  "attaching my",
  "in the attachment",
  "as an attachment",
  "as attachments",
  "enclosed is",
  "enclosed are",
  "enclosed please",
  "please find enclosed",
];

// Does this text promise an attachment? `pfa` is matched only as a standalone
// token so it never fires inside another word.
export function mentionsAttachment(text: string): boolean {
  const t = text.toLowerCase();
  if (/\bpfa\b/.test(t)) return true;
  return ATTACH_PHRASES.some((p) => t.includes(p));
}

// Unfilled placeholders that commonly survive from a template into a sent draft
// — the kind of thing you only notice *after* it goes out. Two families:
//   - an unexpanded merge variable: {{first_name}}, {{company}}, {{date}} …
//   - a bracketed filler keyed on a known placeholder word: "[first name]",
//     "[insert link here]", "[date]", "[TODO]" …
// High precision on purpose: the bracket match requires one of a curated set of
// filler words, so an ordinary "[1]" footnote, a "[EXTERNAL]" tag or a markdown
// "[x]" checkbox is left alone. Drafts here are review-only, so a stray
// placeholder is exactly the human-fixable thing a send guard should surface.
const VAR_TOKEN_RE = /\{\{\s*[\w.]+\s*\}\}/g;
const PLACEHOLDER_WORDS = [
  "insert", "add", "enter", "fill in", "your name", "their name", "recipient",
  "name", "first name", "last name", "full name", "company", "client",
  "customer", "date", "time", "link", "url", "topic", "title", "role", "amount",
  "number", "price", "product", "team", "location", "address", "deadline",
  "tbd", "todo", "placeholder",
];
const BRACKET_PLACEHOLDER_RE = new RegExp(
  `\\[\\s*(?:${PLACEHOLDER_WORDS.map((w) => w.replace(/ /g, "\\s+")).join("|")})\\b[^\\]]*\\]`,
  "gi",
);

// The distinct placeholder strings still present in `text` (merge tokens first,
// then bracketed fillers), de-duplicated and in first-seen order within family.
export function unfilledPlaceholders(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(VAR_TOKEN_RE)) found.push(m[0].trim());
  for (const m of text.matchAll(BRACKET_PLACEHOLDER_RE)) found.push(m[0].trim());
  return [...new Set(found)];
}

// Run every pre-send check against a draft. `hasAttachment` lets a future
// file-carrying draft suppress the attachment nudge; today it's always false.
export function composeChecks(
  draft: Draft,
  opts: { hasAttachment?: boolean } = {},
): ComposeCheck[] {
  const checks: ComposeCheck[] = [];

  // 1. Recipients. No "To" at all genuinely can't send (block); a malformed
  //    address is a warn so an unusual-but-intentional address can still go.
  const recipients = parseRecipients(draft.to);
  if (recipients.length === 0) {
    checks.push({
      code: "no-recipient",
      level: "block",
      message: "Add at least one recipient in “To”.",
    });
  } else {
    const bad = invalidRecipients(draft.to);
    if (bad.length) {
      checks.push({
        code: "invalid-recipient",
        level: "warn",
        message:
          bad.length === 1
            ? `“${bad[0]}” doesn’t look like a valid email address.`
            : `${bad.length} of the “To” addresses don’t look valid.`,
      });
    }
  }

  // Cc / Bcc typos are always a soft warn.
  const badCc = [...invalidRecipients(draft.cc), ...invalidRecipients(draft.bcc)];
  if (badCc.length) {
    checks.push({
      code: "invalid-cc",
      level: "warn",
      message: `Check the Cc/Bcc address${badCc.length > 1 ? "es" : ""}: ${badCc.join(", ")}.`,
    });
  }

  // Large visible audience (To + Cc) — Bcc keeps a big list private and avoids a
  // reply-all storm. Bcc itself is excluded since it's already the right tool.
  const visible = recipients.length + parseRecipients(draft.cc).length;
  if (visible >= MANY_RECIPIENTS) {
    checks.push({
      code: "many-recipients",
      level: "warn",
      message: `You're sending to ${visible} visible recipients — consider Bcc for a large group.`,
    });
  }

  // 2. Empty subject (Gmail confirms this too).
  if (!draft.subject.trim()) {
    checks.push({ code: "no-subject", level: "warn", message: "Send without a subject?" });
  }

  // 3. Empty body.
  if (!draft.body.trim()) {
    checks.push({ code: "no-body", level: "warn", message: "Send an empty message?" });
  }

  // 4. Forgot the attachment. Scan only what the sender wrote *this time* (the
  //    visible portion above any quoted reply trail) plus the subject, so a
  //    "see attached" buried in the quoted history doesn't false-positive.
  const fresh = splitQuoted(draft.body).visible;
  if (!opts.hasAttachment && mentionsAttachment(draft.subject + "\n" + fresh)) {
    checks.push({
      code: "forgot-attachment",
      level: "warn",
      message: "Your message mentions an attachment, but none is attached.",
    });
  }

  // 5. Unfilled template placeholders ({{first_name}}, "[insert link]"). Scan
  //    only the fresh text + subject so a merge token sitting in someone's
  //    quoted signature below doesn't trip it.
  const placeholders = unfilledPlaceholders(draft.subject + "\n" + fresh);
  if (placeholders.length) {
    const shown = placeholders.slice(0, 2).join(", ");
    checks.push({
      code: "placeholder",
      level: "warn",
      message:
        placeholders.length === 1
          ? `This still has a placeholder to fill in: ${shown}.`
          : `This still has unfilled placeholders: ${shown}${placeholders.length > 2 ? ", …" : ""}.`,
    });
  }

  return checks;
}

export function blockingChecks(checks: ComposeCheck[]): ComposeCheck[] {
  return checks.filter((c) => c.level === "block");
}

export function hasBlockers(checks: ComposeCheck[]): boolean {
  return checks.some((c) => c.level === "block");
}
