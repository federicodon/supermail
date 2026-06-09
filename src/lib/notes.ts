// Private conversation notes.
//
// A power user often needs to jot context on a thread — "waiting on legal",
// "promised a demo Friday", "this is the renewal" — without emailing anyone.
// Superhuman has notes/comments; SuperMail keeps a private, local-only note per
// conversation. Notes never leave the device and are never sent.
//
// Storage is a plain map of threadId -> note text so it serializes trivially and
// merges cleanly with the rest of the persisted state. All helpers are pure and
// immutable (they return a new map) so they are unit-tested directly and play
// nicely with React state.

export type NoteMap = Record<string, string>;

// The note for a thread, or "" when there is none.
export function getNote(notes: NoteMap, threadId: string): string {
  return notes[threadId] ?? "";
}

// Does this thread carry a (non-empty) note?
export function hasNote(notes: NoteMap, threadId: string): boolean {
  return getNote(notes, threadId).trim().length > 0;
}

// Set (or clear) a thread's note. Trailing/leading whitespace is trimmed; an
// empty result removes the key entirely so `hasNote` stays accurate and the blob
// doesn't accumulate dead entries. Returns a new map (never mutates the input).
export function setNote(notes: NoteMap, threadId: string, text: string): NoteMap {
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    if (!(threadId in notes)) return notes;
    const next = { ...notes };
    delete next[threadId];
    return next;
  }
  return { ...notes, [threadId]: trimmed };
}

// Thread ids that have a note (insertion order).
export function notedThreadIds(notes: NoteMap): string[] {
  return Object.keys(notes).filter((id) => hasNote(notes, id));
}

// How many conversations carry a note.
export function noteCount(notes: NoteMap): number {
  return notedThreadIds(notes).length;
}

// Defensive load: keep only string-valued, non-empty entries. Used so a corrupt
// or hand-edited blob can never inject non-string notes into the UI.
export function sanitizeNotes(raw: unknown): NoteMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: NoteMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}
