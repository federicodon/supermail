// Trim quoted reply history from an email body — Gmail / Superhuman's
// "show trimmed content" affordance. When you reply, most clients append the
// entire conversation below your new text ("On Mon, Dana wrote: > ..."). A
// power-mail reader hides that wall of quoted history behind a small toggle and
// shows only the words the sender actually wrote this time.
//
// Pure and deterministic — no dependencies, anchored only to the text. Used by
// the conversation reader (MessageItem) to split each message into the new
// content and the (collapsed) quoted trail.

export interface SplitBody {
  // The new content the sender actually wrote in this message.
  visible: string;
  // The trimmed quoted history below it (attribution line + quoted thread),
  // or null when the message has none.
  quoted: string | null;
}

// Attribution lines that introduce a quoted reply, e.g.
//   "On Mon, Jun 2, 2025 at 9:01 AM Dana Lee <dana@x.com> wrote:"
//   "On 02/06/2025 at 14:00, Dana wrote:"
// Strict: must start with "On" and end with "wrote:" so a normal sentence like
// "On Monday I'll send the report" never trips it.
const ATTRIBUTION = /^\s*On\b[\s\S]*\bwrote:\s*$/i;
// Client separators (Outlook / Gmail forwards / generic).
const ORIGINAL_MESSAGE = /^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i;
const FORWARDED_MESSAGE = /^\s*-{2,}\s*Forwarded message\s*-{2,}\s*$/i;
// Outlook header block: a "From:" line that is followed (within a few lines) by
// another header field, so a casual "From: the whole team, thanks" isn't a
// false positive.
const OUTLOOK_FROM = /^\s*From:\s.+/i;
const OUTLOOK_FOLLOWUP = /^\s*(Sent|To|Subject|Date|Cc):\s/i;

// A single quoted line (">" or "> " prefixed, any depth like ">>").
export function isQuoteLine(line: string): boolean {
  return /^\s*>/.test(line);
}

// The 0-based index of the first line that begins the quoted trail, or -1 when
// the body has no quoted history.
function quoteStartIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ATTRIBUTION.test(line) || ORIGINAL_MESSAGE.test(line) || FORWARDED_MESSAGE.test(line)) {
      return i;
    }
    // A "From:" header only counts as a quoted Outlook block when one of the
    // sibling headers follows close behind.
    if (OUTLOOK_FROM.test(line)) {
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        if (OUTLOOK_FOLLOWUP.test(lines[j])) return i;
      }
    }
    // A run of ">"-quoted lines begins the trail. Pull a single attribution
    // line directly above it into the quote (it belongs with the history).
    if (isQuoteLine(line)) {
      const prev = i > 0 ? lines[i - 1].trim() : "";
      if (i > 0 && prev !== "" && /wrote:\s*$/i.test(prev)) return i - 1;
      return i;
    }
  }
  return -1;
}

// Drop trailing blank lines (keeps interior spacing).
function trimTrailingBlank(text: string): string {
  return text.replace(/\s+$/, "");
}

// Split a raw message body into the freshly-written content and the trimmed
// quoted history below it.
export function splitQuoted(body: string): SplitBody {
  if (!body) return { visible: "", quoted: null };
  const lines = body.split("\n");
  const start = quoteStartIndex(lines);
  if (start < 0) return { visible: trimTrailingBlank(body), quoted: null };
  const visible = trimTrailingBlank(lines.slice(0, start).join("\n"));
  const quoted = lines.slice(start).join("\n").trim();
  return { visible, quoted: quoted.length ? quoted : null };
}

// Does this body carry quoted history?
export function hasQuoted(body: string): boolean {
  return splitQuoted(body).quoted !== null;
}

// Number of non-empty lines in the quoted trail — used to label the toggle
// ("Show trimmed content · 6 lines").
export function quotedLineCount(quoted: string | null): number {
  if (!quoted) return 0;
  return quoted.split("\n").filter((l) => l.trim().length > 0).length;
}

// Quote an arbitrary text selection for a reply — Superhuman / Gmail "reply to
// the part you selected". Each line of the selection is prefixed with "> "
// (blank lines collapse to a bare ">"), leading indentation preserved, with the
// surrounding whitespace and CRLFs normalized. Returns "" for empty input so
// callers can fall back to quoting the whole message. The attribution line
// ("On … wrote:") is added by the caller, matching the default reply format.
export function quoteText(selected: string): string {
  const norm = selected.replace(/\r\n?/g, "\n").trim();
  if (!norm) return "";
  return norm
    .split("\n")
    .map((l) => (l.trim().length ? `> ${l}` : ">"))
    .join("\n");
}
