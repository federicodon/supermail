// "We noticed a date" — detect time references inside an email and offer to
// snooze / remind exactly then.
//
// Superhuman-style magic: an email says "let's circle back Friday at 5pm" and
// the client offers a one-click "Remind me Friday 5pm". This module scans the
// message text for time phrases and hands each candidate to the existing
// `parseNaturalTime` engine for resolution — we only *locate* references; the
// engine does the real date math. Pure and React-free.
//
// False-positive discipline: full weekday names ("friday") are accepted bare,
// but three-letter abbreviations ("fri", and the English-word-prone "sat" /
// "sun" / "wed") are only accepted when immediately followed by a clock time,
// so prose like "I sat down" or "in the sun" never reads as a date.

import { parseNaturalTime, formatWhen } from "./naturalTime";

export interface TimeMention {
  phrase: string; // the text as it appeared, e.g. "Friday at 5pm"
  at: Date; // resolved future time
  label: string; // human label, e.g. "Fri, 5:00 PM"
  ms: number; // offset from `now` (for the snooze / remind APIs)
}

// A clock time: "5pm", "5 pm", "5:30pm", "5:30 p.m.", "17:00", "noon", a day-part.
const TIME =
  "(?:\\d{1,2}(?::\\d{2})?\\s*[ap]\\.?m\\.?|\\d{1,2}:\\d{2}|noon|midnight|morning|afternoon|evening|night)";
// An optional trailing time clause: " at 5pm" / " 5pm" / " evening".
const AT_TIME = `(?:\\s+(?:at\\s+|@\\s*)?${TIME})?`;

interface MentionPattern {
  re: RegExp;
  group?: number; // which capture group to *resolve* (default: whole match)
}

const PATTERNS: MentionPattern[] = [
  // "in 2 hours", "in 3 days at 9am"
  { re: new RegExp(`\\bin \\d{1,3} (?:hours?|days?|weeks?)${AT_TIME}`, "gi") },
  // tomorrow / today / tonight (+ optional time)
  { re: new RegExp(`\\b(?:tomorrow|tonight|today)${AT_TIME}`, "gi") },
  // [next] full weekday name (+ optional time) — bare is safe
  {
    re: new RegExp(
      `\\b(?:next\\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\b${AT_TIME}`,
      "gi"
    ),
  },
  // [next] weekday abbreviation — REQUIRES a trailing time (avoids "sat"/"sun" prose)
  {
    re: new RegExp(
      `\\b(?:next\\s+)?(?:mon|tues?|weds?|thurs?|thur|fri|sat|sun)\\s+(?:at\\s+)?${TIME}\\b`,
      "gi"
    ),
  },
  // fuzzy anchors the engine understands
  { re: /\bend of (?:the )?(?:day|week)\b/gi },
  { re: /\bnext (?:week|month|weekend)\b/gi },
  { re: /\bthis (?:morning|afternoon|evening|weekend)\b/gi },
  // a deadline time: "by 5pm", "before 9:30am" — resolve just the time
  { re: new RegExp(`\\b(?:by|before)\\s+(?:at\\s+)?(${TIME})\\b`, "gi"), group: 1 },
];

const HORIZON_MS = 120 * 86_400_000; // ignore anything more than ~4 months out

// Find up to `max` distinct future time references in `text`, soonest first.
export function extractTimeMentions(text: string, now: number, max = 3): TimeMention[] {
  if (!text) return [];
  const out: TimeMention[] = [];
  const seenPhrase = new Set<string>();
  const seenInstant = new Set<number>();

  for (const { re, group } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0] === "") {
        re.lastIndex++;
        continue;
      }
      const phrase = m[0].trim().replace(/\s+/g, " ");
      const toResolve = (group != null ? m[group] : m[0]) ?? "";
      const key = phrase.toLowerCase();
      if (seenPhrase.has(key)) continue;
      seenPhrase.add(key);

      const parsed = parseNaturalTime(toResolve, now);
      if (!parsed) continue;
      const t = parsed.at.getTime();
      if (t <= now || t - now > HORIZON_MS) continue; // future, within horizon
      if (seenInstant.has(t)) continue;
      seenInstant.add(t);

      out.push({ phrase, at: parsed.at, label: formatWhen(parsed.at, now), ms: t - now });
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, max);
}
