import type { View } from "../types";

// Conversation-row hover quick-actions.
//
// Superhuman shows a small action toolbar on a row when you hover it, so you can
// triage without opening the conversation or reaching for the keyboard. SuperMail
// mirrors that: this pure helper decides *which* actions a row offers given the
// folder you're in and the row's current state (so the toggle verbs read right —
// "Mark read" only when there's something unread, "Unpin" only when pinned). The
// App maps each returned id to the same handler the keyboard shortcuts use, so
// hover, keyboard and the reader all stay perfectly consistent.

export type RowActionId =
  | "archive"
  | "trash"
  | "snooze"
  | "read"
  | "unread"
  | "pin"
  | "unpin"
  | "restore"
  | "notSpam"
  | "deleteForever";

export interface RowAction {
  id: RowActionId;
  label: string; // tooltip / accessible label (includes the key hint)
  icon: string; // glyph shown in the button
}

// The minimal row state the action set depends on.
export interface RowActionState {
  hasUnread: boolean;
  pinned: boolean;
}

export function rowActions(row: RowActionState, view: View): RowAction[] {
  // Trash and Spam are recovery folders — their rows offer restore + purge only.
  if (view === "trash") {
    return [
      { id: "restore", label: "Restore to inbox", icon: "♻️" },
      { id: "deleteForever", label: "Delete forever", icon: "⌫" },
    ];
  }
  if (view === "spam") {
    return [
      { id: "notSpam", label: "Not spam", icon: "✓" },
      { id: "deleteForever", label: "Delete forever", icon: "⌫" },
    ];
  }
  return [
    { id: "archive", label: "Archive (E)", icon: "✓" },
    { id: "snooze", label: "Snooze (H)", icon: "💤" },
    { id: "trash", label: "Delete (#)", icon: "🗑" },
    row.hasUnread
      ? { id: "read", label: "Mark read (T)", icon: "◯" }
      : { id: "unread", label: "Mark unread (⇧U)", icon: "●" },
    row.pinned
      ? { id: "unpin", label: "Unpin (P)", icon: "📌" }
      : { id: "pin", label: "Pin (P)", icon: "📍" },
  ];
}
