import type { Email } from "../types";

// Which message a Reply / Forward should act on inside an open conversation.
//
// With in-thread keyboard navigation (src/lib/messageNav.ts) the user can focus
// any message. Reply should respect that focus — but you reply *to* someone, so
// a focused *outbound* (your own) message isn't a sensible reply target; in that
// case fall back to the latest inbound message, and if the whole thread is
// outbound, the latest message. Forward, by contrast, can act on any message
// (you might forward your own), so it just uses the focused-or-latest one.
//
// Messages are ordered oldest → newest (the latest is last).

export function replyTargetMessage(messages: Email[], focusedId: string | null): Email | null {
  if (messages.length === 0) return null;
  const focused = focusedId ? messages.find((m) => m.id === focusedId) : undefined;
  if (focused && !focused.outbound) return focused;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].outbound) return messages[i];
  }
  return messages[messages.length - 1];
}

export function focusedOrLatest(messages: Email[], focusedId: string | null): Email | null {
  if (messages.length === 0) return null;
  const focused = focusedId ? messages.find((m) => m.id === focusedId) : undefined;
  return focused ?? messages[messages.length - 1];
}

export function selectionWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function selectionPreview(text: string, max = 96): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
