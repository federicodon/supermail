// "Send & Archive" — Superhuman's (and Gmail's) reply-and-move-on flow. When you
// answer a conversation you usually want it out of your inbox; this models the
// decision of what to archive after a send so the App can apply it and the logic
// stays unit-testable. Pure: no side effects, no React.
//
// SuperMail never actually transmits mail (sending is permanently disabled — see
// safety.ts); "send" here queues a reviewable draft into the local outbox. The
// archive is an ordinary, undoable triage on the conversation.

import type { Draft } from "../types";

export interface SendOutcome {
  // The conversation to archive after the send, or null when nothing should be
  // archived (a brand-new message with no thread, a scheduled send, or the
  // preference/intent is off).
  archiveThreadId: string | null;
}

// A draft is a reply within an existing conversation when it both answers a
// message and carries that conversation's id.
export function isReplyDraft(draft: Draft): boolean {
  return Boolean(draft.inReplyTo) && Boolean(draft.threadId);
}

// Decide the post-send archive. `andArchive` is the caller's intent — the
// explicit "Send & Archive" action, or the global "archive on reply" preference.
// We only ever archive a reply to an existing thread, never a new message and
// never a scheduled (Send Later) message, which stays put until it goes out.
export function postSendOutcome(
  draft: Draft,
  andArchive: boolean,
  opts: { scheduled?: boolean } = {}
): SendOutcome {
  if (!andArchive || opts.scheduled) return { archiveThreadId: null };
  return { archiveThreadId: isReplyDraft(draft) ? draft.threadId ?? null : null };
}
