import type { Snippet } from "../types";

// Snippet / text-expansion engine.
//
// Superhuman's "Compose Quickly" lets a saved snippet carry variables that fill
// from the message context ({{first_name}}, {{my_name}}, {{date}}…) and a
// {{cursor}} marker for where the caret lands after expansion. This module is the
// pure, unit-testable core; Compose wires it to the textarea.
//
// All date/time tokens render in UTC for deterministic behavior (consistent with
// the calendar engine); a real localized build would honor the user's timezone.

export interface SnippetContext {
  // The other party. recipientName wins; otherwise the name is derived from the
  // local-part of recipientEmail (e.g. "dana.whitman@x.com" -> "Dana Whitman").
  recipientName?: string;
  recipientEmail?: string;
  myName?: string; // the sender's display name (from personalization/settings)
  now?: number; // epoch ms for {{date}}/{{day}}/{{time}}; defaults to Date.now()
}

export interface SnippetVariable {
  token: string;
  desc: string;
}

// Advertised in the Settings snippet editor so users know what they can type.
export const SNIPPET_VARIABLES: SnippetVariable[] = [
  { token: "{{name}}", desc: "Recipient's first name" },
  { token: "{{first_name}}", desc: "Recipient's first name" },
  { token: "{{last_name}}", desc: "Recipient's last name" },
  { token: "{{full_name}}", desc: "Recipient's full name" },
  { token: "{{email}}", desc: "Recipient's email address" },
  { token: "{{my_name}}", desc: "Your name" },
  { token: "{{my_first_name}}", desc: "Your first name" },
  { token: "{{date}}", desc: "Today's date (YYYY-MM-DD, UTC)" },
  { token: "{{day}}", desc: "Today's weekday" },
  { token: "{{time}}", desc: "Current time (HH:MM, UTC)" },
  { token: "{{cursor}}", desc: "Where the cursor lands after inserting" },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Turn an email address into a best-effort "First Last" display name.
export function deriveName(email?: string): { first: string; last: string; full: string } {
  const local = (email ?? "").split("@")[0];
  if (!local) return { first: "there", last: "", full: "there" };
  const parts = local.split(/[._\-+]/).filter(Boolean).map(cap);
  const first = parts[0] ?? "there";
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return { first, last, full: parts.join(" ") || first };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function buildMap(ctx: SnippetContext): Record<string, string> {
  const now = ctx.now ?? Date.now();
  const d = new Date(now);
  const fromEmail = deriveName(ctx.recipientEmail);
  // Prefer an explicit recipient name; else derive from the email.
  const fullName = ctx.recipientName?.trim() || fromEmail.full;
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const first = nameParts[0] || fromEmail.first;
  const last = nameParts.length > 1 ? nameParts[nameParts.length - 1] : fromEmail.last;
  const myFull = (ctx.myName ?? "").trim();
  const myFirst = myFull.split(/\s+/)[0] ?? "";
  return {
    "{{name}}": first,
    "{{first_name}}": first,
    "{{last_name}}": last,
    "{{full_name}}": fullName,
    "{{email}}": ctx.recipientEmail ?? "",
    "{{my_name}}": myFull,
    "{{my_first_name}}": myFirst,
    "{{date}}": `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    "{{day}}": DAYS[d.getUTCDay()],
    "{{time}}": `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

// Expand a snippet template. Returns the filled text and the caret offset that a
// {{cursor}} marker requested (or the end of the text if none was present).
export function expandSnippet(template: string, ctx: SnippetContext = {}): { text: string; cursor: number } {
  const map = buildMap(ctx);
  let text = template;
  for (const token of Object.keys(map)) {
    text = text.split(token).join(map[token]);
  }
  const ci = text.indexOf("{{cursor}}");
  if (ci >= 0) {
    // Everything before the first marker is final, so its index is the caret.
    text = text.split("{{cursor}}").join("");
    return { text, cursor: ci };
  }
  return { text, cursor: text.length };
}

// Find the snippet whose shortcut the text-before-the-caret ends with. Longest
// shortcut wins so ";fu" beats ";f" when both are defined.
export function matchSnippetAt(
  snippets: Snippet[],
  body: string,
  caret: number
): { snippet: Snippet; start: number } | null {
  const before = body.slice(0, caret);
  const candidates = snippets
    .filter((s) => s.shortcut && before.endsWith(s.shortcut))
    .sort((a, b) => b.shortcut.length - a.shortcut.length);
  const snippet = candidates[0];
  if (!snippet) return null;
  return { snippet, start: caret - snippet.shortcut.length };
}

// Expand a just-typed shortcut at the caret. Returns the rewritten body and the
// new caret position; `expanded` is false when nothing matched (the common case
// on every keystroke).
export function expandAtCaret(
  body: string,
  caret: number,
  snippets: Snippet[],
  ctx: SnippetContext = {}
): { body: string; caret: number; expanded: boolean } {
  const hit = matchSnippetAt(snippets, body, caret);
  if (!hit) return { body, caret, expanded: false };
  const { text, cursor } = expandSnippet(hit.snippet.body, ctx);
  const newBody = body.slice(0, hit.start) + text + body.slice(caret);
  return { body: newBody, caret: hit.start + cursor, expanded: true };
}
