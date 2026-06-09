// Private, person-scoped notes.
//
// Distinct from the thread-scoped conversation notes in notes.ts: this is a note
// you keep ABOUT a person — "prefers concise replies", "met at the 2025 offsite",
// "this is the economic buyer", "always cc their assistant" — that follows them
// across every conversation. Surfaced on the reader's sender card and the People
// profile. Local-only, never sent.
//
// Keyed by a *normalized* (lowercased, trimmed) email so a contact is one note no
// matter how their address was capitalized across messages. All helpers are pure
// and immutable so they unit-test directly and play nicely with React state.

import type { NoteMap } from "./notes";

export type ContactNoteMap = NoteMap; // normalized-email -> note text

export function normEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

// The note kept about a person, or "" when there is none.
export function getContactNote(map: ContactNoteMap, email: string): string {
  return map[normEmail(email)] ?? "";
}

// Does this person carry a (non-empty) note?
export function hasContactNote(map: ContactNoteMap, email: string): boolean {
  return getContactNote(map, email).trim().length > 0;
}

// Set (or clear) a person's note. The key is normalized and the text trimmed; an
// empty result removes the key so `hasContactNote` stays accurate and the blob
// doesn't accumulate dead entries. Returns the SAME map reference on a no-op
// (clearing a missing note, or setting the identical text) so React doesn't
// re-render needlessly; otherwise a new map (never mutates the input).
export function setContactNote(map: ContactNoteMap, email: string, text: string): ContactNoteMap {
  const key = normEmail(email);
  if (!key) return map;
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    if (!(key in map)) return map;
    const next = { ...map };
    delete next[key];
    return next;
  }
  if (map[key] === trimmed) return map;
  return { ...map, [key]: trimmed };
}

// Normalized emails that carry a note (insertion order).
export function contactNoteEmails(map: ContactNoteMap): string[] {
  return Object.keys(map).filter((k) => (map[k] ?? "").trim().length > 0);
}

// How many people carry a note.
export function contactNoteCount(map: ContactNoteMap): number {
  return contactNoteEmails(map).length;
}

// Defensive load: normalize keys, keep only string-valued, non-empty entries, and
// trim. Used so a corrupt or hand-edited blob can never inject bad notes.
export function sanitizeContactNotes(raw: unknown): ContactNoteMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ContactNoteMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = normEmail(k);
    if (key && typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}
