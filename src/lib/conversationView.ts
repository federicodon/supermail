// Pure helpers for the conversation reader's expand / collapse state. Gmail and
// Superhuman open a thread with only the latest message expanded and the older
// ones collapsed to one-line headers; you can then expand any message, or
// expand / collapse the whole thread at once. Keeping that logic here (operating
// on message-id arrays and an immutable Set) makes it testable away from React
// and keeps the reader render simple.

// The set of message ids expanded by default when a thread opens — just the
// latest (last) message, like Gmail/Superhuman.
export function defaultExpanded(messageIds: string[]): Set<string> {
  const s = new Set<string>();
  if (messageIds.length > 0) s.add(messageIds[messageIds.length - 1]);
  return s;
}

// Toggle one message's expanded state, returning a new Set.
export function toggleExpanded(expanded: Set<string>, id: string): Set<string> {
  const next = new Set(expanded);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

// Expand every message in the thread.
export function expandAll(messageIds: string[]): Set<string> {
  return new Set(messageIds);
}

// Collapse back to just the latest message expanded.
export function collapseToLatest(messageIds: string[]): Set<string> {
  return defaultExpanded(messageIds);
}

// Are all messages currently expanded? (Empty thread → false.)
export function allExpanded(expanded: Set<string>, messageIds: string[]): boolean {
  return messageIds.length > 0 && messageIds.every((id) => expanded.has(id));
}

// The label/affordance for the whole-thread toggle, given the current state.
// When everything is open the next action collapses; otherwise it expands all.
export function expandToggleLabel(expanded: Set<string>, messageIds: string[]): {
  willExpand: boolean;
  label: string;
} {
  const open = allExpanded(expanded, messageIds);
  return open
    ? { willExpand: false, label: "Collapse all" }
    : { willExpand: true, label: "Expand all" };
}

// Number of collapsed (hidden) messages — used for a subtle "+N earlier" hint.
export function collapsedCount(expanded: Set<string>, messageIds: string[]): number {
  return messageIds.reduce((n, id) => (expanded.has(id) ? n : n + 1), 0);
}
