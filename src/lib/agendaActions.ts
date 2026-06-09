// Quick-actions for the "Today" agenda rows. A daily agenda you can only stare
// at is half a feature — Superhuman's rhythm is acting from every surface. Each
// agenda item kind exposes the one secondary action that makes sense for it
// (opening the underlying thread/event/outbox is the row click itself):
//
//   • reminder / follow-up  → ✓ Done       (clear the reminder — it's handled)
//   • snoozed conversation  → ⏪ Return now (bring it back to the inbox now)
//   • scheduled send        → ✕ Cancel     (cancel the queued send)
//   • calendar event        → (none — we never mutate a real calendar)
//
// Pure and deterministic — the App maps each action id to the same handler the
// Reminders / Snoozed / Outbox views already use, so the agenda never drifts
// from them.

import type { AgendaItem } from "./agenda";

export type AgendaActionId = "done" | "unsnooze" | "cancelSend";

export interface AgendaAction {
  id: AgendaActionId;
  label: string;
  icon: string;
  title: string; // tooltip / a11y description
}

export function agendaActions(item: AgendaItem): AgendaAction[] {
  switch (item.kind) {
    case "reminder":
    case "followup":
      return [
        { id: "done", label: "Done", icon: "✓", title: "Mark done — clears the reminder" },
      ];
    case "snoozed":
      return [
        {
          id: "unsnooze",
          label: "Return now",
          icon: "⏪",
          title: "Return this conversation to the inbox now",
        },
      ];
    case "send":
      return [
        { id: "cancelSend", label: "Cancel", icon: "✕", title: "Cancel this scheduled send" },
      ];
    case "event":
    default:
      return [];
  }
}

// Does this item offer any quick-action? (Events don't.)
export function hasAgendaActions(item: AgendaItem): boolean {
  return agendaActions(item).length > 0;
}
