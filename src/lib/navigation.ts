// Conversation-flow navigation — the math behind Superhuman-style "auto-advance".
//
// When you triage the conversation you're reading (archive / delete / snooze /
// mute / spam), it leaves the current list and the reader should jump straight
// to the *next* conversation instead of dumping you back to the list. That keeps
// you in a tight "open → act → open → act" rhythm and is core to processing an
// inbox at speed.
//
// `nextAfterRemoval` is the pure kernel: given the ordered ids currently on
// screen and the id about to be removed, it returns which id should be focused
// next and the index that id will occupy *after* the removal (so the list cursor
// can be kept aligned). It is deterministic and React-free, so it is unit
// tested in isolation.

export interface NextFocus {
  id: string | null; // the conversation to open next, or null if none remains
  index: number; // its index in the list AFTER `removedId` is removed (-1 if none)
}

// Pick the focus target after `removedId` leaves `ids`:
//  - prefer the next conversation down (it slides up into the freed slot), so
//    the index is unchanged;
//  - if we removed the last row, fall back to the previous one (index - 1);
//  - if the list becomes empty, there is nothing to focus.
export function nextAfterRemoval(ids: string[], removedId: string): NextFocus {
  const idx = ids.indexOf(removedId);
  if (idx === -1) return { id: null, index: -1 };
  // There is a row below: it shifts up into `idx`.
  if (idx + 1 < ids.length) return { id: ids[idx + 1], index: idx };
  // We removed the last row: focus the one above, whose index is unchanged.
  if (idx - 1 >= 0) return { id: ids[idx - 1], index: idx - 1 };
  // The list is now empty.
  return { id: null, index: -1 };
}

// Step the list cursor to an adjacent row with NO wrap-around. This is the
// kernel behind the "flip to the next / previous conversation" shortcuts
// (Shift+J / Shift+K), which move *and open* the neighbor so you can fly through
// the inbox without leaving the reader. Returns the clamped target index, or -1
// for an empty list. A `current` outside the list is treated as "before the
// start" (for a forward step) or clamped to the end (for a backward step), so a
// first Shift+J with nothing selected lands on row 0.
export function neighborIndex(length: number, current: number, dir: 1 | -1): number {
  if (length <= 0) return -1;
  const base = current < 0 ? (dir === 1 ? -1 : 0) : Math.min(current, length - 1);
  return Math.max(0, Math.min(base + dir, length - 1));
}
