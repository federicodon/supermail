// Multi-select helpers.
//
// The inbox list lets you select many conversations at once (Superhuman's `x`
// to select, shift-click to range) and act on them in bulk. Selection is just a
// Set of thread ids; these pure helpers own the set math so the UI stays thin
// and the behaviour is unit-tested.

// Toggle one id in/out of the selection, returning a new set.
export function toggleId(ids: Iterable<string>, id: string): Set<string> {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// The ids between two indices (inclusive), order-independent.
export function rangeIds(ordered: string[], fromIdx: number, toIdx: number): string[] {
  if (!ordered.length) return [];
  const lo = Math.max(0, Math.min(fromIdx, toIdx));
  const hi = Math.min(ordered.length - 1, Math.max(fromIdx, toIdx));
  return ordered.slice(lo, hi + 1);
}

// Add an inclusive range to the selection (shift-click).
export function withRange(
  base: Iterable<string>,
  ordered: string[],
  fromIdx: number,
  toIdx: number
): Set<string> {
  const next = new Set(base);
  for (const id of rangeIds(ordered, fromIdx, toIdx)) next.add(id);
  return next;
}

// Are all of the currently-visible ids selected?
export function allSelected(ordered: string[], sel: ReadonlySet<string>): boolean {
  return ordered.length > 0 && ordered.every((id) => sel.has(id));
}

// Select-all when not all selected; clear when everything is already selected.
export function toggleAll(ordered: string[], sel: ReadonlySet<string>): Set<string> {
  return allSelected(ordered, sel) ? new Set() : new Set(ordered);
}

// Drop ids that are no longer visible (keeps the selection from going stale).
export function prune(sel: ReadonlySet<string>, visible: Iterable<string>): Set<string> {
  const keep = new Set(visible);
  const next = new Set<string>();
  for (const id of sel) if (keep.has(id)) next.add(id);
  return next;
}
