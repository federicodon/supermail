import type { Draft, OutboxItem } from "../types";

// Send Later + undo-send model.
//
// Every send goes through the outbox. A normal send sits there for the undo
// window (default 10s, configurable) before leaving; a scheduled send sits
// there until its time. This mirrors Superhuman's "send later" + "undo send".

export interface SendLaterPreset {
  label: string;
  ms: number;
}

export const SEND_LATER_PRESETS: SendLaterPreset[] = [
  { label: "In 1 hour", ms: 3600_000 },
  { label: "This evening (6pm)", ms: 6 * 3600_000 },
  { label: "Tomorrow 8am", ms: 20 * 3600_000 },
  { label: "Monday 8am", ms: 3 * 24 * 3600_000 },
];

export const DEFAULT_UNDO_WINDOW_MS = 10_000;

let seq = 0;
function nextId(): string {
  seq += 1;
  return `out-${seq}`;
}

// Queue a draft. If `scheduledAt` is set, that's the send time; otherwise the
// message leaves after the undo window.
export function enqueue(
  draft: Draft,
  now: number,
  undoWindowMs = DEFAULT_UNDO_WINDOW_MS
): OutboxItem {
  const sendAt = draft.scheduledAt
    ? draft.scheduledAt
    : new Date(now + undoWindowMs).toISOString();
  return {
    id: nextId(),
    draft,
    sendAt,
    status: "scheduled",
    createdAt: new Date(now).toISOString(),
  };
}

export function isDue(item: OutboxItem, now: number): boolean {
  return item.status === "scheduled" && new Date(item.sendAt).getTime() <= now;
}

// Advance the outbox: mark due items as sent. Returns the new list plus the
// items that just sent (so the UI can move them into the thread / flash a toast).
export function tickOutbox(
  outbox: OutboxItem[],
  now: number
): { outbox: OutboxItem[]; justSent: OutboxItem[] } {
  const justSent: OutboxItem[] = [];
  const next = outbox.map((item) => {
    if (isDue(item, now)) {
      const sent = { ...item, status: "sent" as const };
      justSent.push(sent);
      return sent;
    }
    return item;
  });
  return { outbox: next, justSent };
}

export function cancel(outbox: OutboxItem[], id: string): OutboxItem[] {
  return outbox.map((i) =>
    i.id === id && i.status === "scheduled" ? { ...i, status: "canceled" } : i
  );
}

// Move a still-scheduled send to a new time (Superhuman "reschedule"). Only
// touches items that haven't left yet, keeps the draft's `scheduledAt` in sync,
// and returns the same array reference when nothing changes (unknown id, not
// scheduled, or the same time) so React can skip a re-render.
export function reschedule(outbox: OutboxItem[], id: string, iso: string): OutboxItem[] {
  let changed = false;
  const next = outbox.map((i) => {
    if (i.id === id && i.status === "scheduled" && i.sendAt !== iso) {
      changed = true;
      return { ...i, sendAt: iso, draft: { ...i.draft, scheduledAt: iso } };
    }
    return i;
  });
  return changed ? next : outbox;
}

export function pending(outbox: OutboxItem[]): OutboxItem[] {
  return outbox.filter((i) => i.status === "scheduled");
}

// Can this item still be recalled (it hasn't left yet)?
export function canUndo(item: OutboxItem, now: number): boolean {
  return item.status === "scheduled" && new Date(item.sendAt).getTime() > now;
}

export function sendLaterLabel(item: OutboxItem, now: number): string {
  const diff = new Date(item.sendAt).getTime() - now;
  if (diff <= 0) return "sending…";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}
