// In-thread message navigation.
//
// When a conversation is open, j/k move between the messages *inside* the
// thread (Superhuman/Gmail-style) instead of the conversation list. This module
// holds the pure index math so the reader just tracks a focused message id.
// No wrap-around: hitting the top/bottom of the thread stays put (the caller
// can decide whether an edge press should fall through to list navigation).

// The neighbor of `currentId` in `ids` moving `dir` (+1 down / -1 up). With no
// current focus, entering from the top focuses the first message and from the
// bottom the last. At an edge, returns the same id (no wrap). null if empty.
export function neighborId(
  ids: string[],
  currentId: string | null,
  dir: 1 | -1
): string | null {
  if (ids.length === 0) return null;
  const i = currentId ? ids.indexOf(currentId) : -1;
  if (i === -1) return dir === 1 ? ids[0] : ids[ids.length - 1];
  const next = i + dir;
  if (next < 0 || next >= ids.length) return ids[i]; // clamp at the edge
  return ids[next];
}

// Where focus lands when a conversation opens: the latest (last) message, which
// is the one the reader expands by default.
export function initialFocusId(ids: string[]): string | null {
  return ids.length ? ids[ids.length - 1] : null;
}

// Index of the focused message (or -1), handy for "Message 2 of 5" labels.
export function focusIndex(ids: string[], currentId: string | null): number {
  return currentId ? ids.indexOf(currentId) : -1;
}

export function atFirst(ids: string[], currentId: string | null): boolean {
  return ids.length > 0 && focusIndex(ids, currentId) === 0;
}

export function atLast(ids: string[], currentId: string | null): boolean {
  return ids.length > 0 && focusIndex(ids, currentId) === ids.length - 1;
}
