// Inbox-Zero bulk actions — "clear what I've already seen" / "mark it all read".
//
// Superhuman leans hard on getting to an empty inbox: you blast through with
// per-conversation triage, then sweep the rest in one move. These pure planners
// turn the currently-listed threads into the exact set a sweep would touch, so
// the action is one undoable step and the confirm copy can state a real count.
// React-free and unit tested.

import type { Thread } from "./threads";

export interface ClearPlan {
  ids: string[]; // thread ids the action will touch (order preserved)
  count: number; // ids.length — drives the confirm / toast copy
}

const plan = (threads: Thread[], keep: (t: Thread) => boolean): ClearPlan => {
  const ids = threads.filter(keep).map((t) => t.id);
  return { ids, count: ids.length };
};

// "Mark all as read" — every unread thread currently listed (pinned included:
// reading something doesn't move it). Already-read threads are untouched.
export function markAllReadPlan(threads: Thread[]): ClearPlan {
  return plan(threads, (t) => t.hasUnread);
}

// "Archive all read" — clear the conversations you've already seen, leaving the
// unread ones (and anything pinned) in place. This is the safe Inbox-Zero sweep.
export function archiveReadPlan(threads: Thread[]): ClearPlan {
  return plan(threads, (t) => !t.hasUnread && !t.pinned);
}

// "Archive everything here" — the whole list except pinned. The heavy sweep,
// always worth a confirm.
export function archiveAllPlan(threads: Thread[]): ClearPlan {
  return plan(threads, (t) => !t.pinned);
}
