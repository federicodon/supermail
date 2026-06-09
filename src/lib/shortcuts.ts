import type { ShortcutDef } from "../types";

// Single source of truth for keyboard shortcuts. The global key handler, the
// command palette, and the shortcuts guide all derive from this list so they
// can never drift apart. Coverage mirrors the public Superhuman shortcut sheet
// (navigation, triage, chords, compose) without copying its exact labels.

export const SHORTCUTS: ShortcutDef[] = [
  // Navigation
  { id: "down", keys: ["j"], label: "Move down (list, or messages in a thread)", group: "Navigation" },
  { id: "up", keys: ["k"], label: "Move up (list, or messages in a thread)", group: "Navigation" },
  { id: "next-conversation", keys: ["shift+j"], label: "Next conversation (open it)", group: "Navigation" },
  { id: "prev-conversation", keys: ["shift+k"], label: "Previous conversation (open it)", group: "Navigation" },
  { id: "open", keys: ["Enter"], label: "Open conversation · reply when reading", group: "Navigation", needsCurrent: true },
  { id: "back", keys: ["u"], label: "Back to list", group: "Navigation" },
  { id: "search", keys: ["/"], label: "Search", group: "Navigation" },
  { id: "palette", keys: ["mod+k"], label: "Command palette", group: "Navigation" },
  { id: "help", keys: ["?"], label: "Keyboard shortcuts", group: "Navigation" },

  // Go-to chords (g then key)
  { id: "goto-inbox", keys: ["g", "i"], label: "Go to Inbox", group: "Go to" },
  { id: "goto-today", keys: ["g", "t"], label: "Go to Today (agenda)", group: "Go to" },
  { id: "goto-focus", keys: ["g", "f"], label: "Go to Focus", group: "Go to" },
  { id: "goto-starred", keys: ["g", "s"], label: "Go to Starred", group: "Go to" },
  { id: "goto-snoozed", keys: ["g", "h"], label: "Go to Snoozed", group: "Go to" },
  { id: "goto-reminders", keys: ["g", "r"], label: "Go to Reminders", group: "Go to" },
  { id: "goto-drafts", keys: ["g", "d"], label: "Go to Drafts", group: "Go to" },
  { id: "goto-archive", keys: ["g", "e"], label: "Go to Done / Archive", group: "Go to" },
  { id: "goto-outbox", keys: ["g", "o"], label: "Go to Outbox", group: "Go to" },
  { id: "goto-calendar", keys: ["g", "c"], label: "Go to Calendar", group: "Go to" },
  { id: "goto-people", keys: ["g", "p"], label: "Go to People", group: "Go to" },
  { id: "goto-attachments", keys: ["g", "a"], label: "Go to Attachments", group: "Go to" },
  { id: "goto-settings", keys: ["g", ","], label: "Go to Settings", group: "Go to" },

  // Triage
  { id: "archive", keys: ["e"], label: "Archive (mark done)", group: "Triage", needsCurrent: true },
  { id: "snooze", keys: ["h"], label: "Snooze", group: "Triage", needsCurrent: true },
  { id: "trash", keys: ["#"], label: "Delete (move to Trash)", group: "Triage", needsCurrent: true },
  { id: "spam", keys: ["!"], label: "Mark as spam", group: "Triage", needsCurrent: true },
  { id: "star", keys: ["s"], label: "Star / unstar", group: "Triage", needsCurrent: true },
  { id: "mark-read", keys: ["t"], label: "Toggle read / unread", group: "Triage", needsCurrent: true },
  { id: "mark-unread", keys: ["shift+u"], label: "Mark unread", group: "Triage", needsCurrent: true },
  { id: "mute", keys: ["m"], label: "Mute conversation", group: "Triage", needsCurrent: true },
  { id: "pin", keys: ["p"], label: "Pin / unpin conversation", group: "Triage", needsCurrent: true },
  { id: "label", keys: ["l"], label: "Label conversation", group: "Triage", needsCurrent: true },
  { id: "move", keys: ["v"], label: "Move to split", group: "Triage", needsCurrent: true },
  { id: "note", keys: ["n"], label: "Add / edit private note", group: "Triage", needsCurrent: true },
  { id: "expand-all", keys: ["o"], label: "Expand / collapse all messages", group: "Triage", needsCurrent: true },
  // Remind me has no single key (R is Reply, matching Superhuman); reach it via
  // the command palette, the reader action, or the snooze/remind menu.
  { id: "remind", keys: [], label: "Remind me", group: "Triage", needsCurrent: true },
  { id: "select", keys: ["x"], label: "Select conversation", group: "Triage", needsCurrent: true },
  { id: "auto-archive", keys: ["y"], label: "Accept auto-archive suggestion", group: "Triage", needsCurrent: true },

  // Compose
  { id: "compose", keys: ["c"], label: "Compose", group: "Compose" },
  { id: "reply", keys: ["r"], label: "Reply", group: "Compose", needsCurrent: true },
  { id: "reply-all", keys: ["a"], label: "Reply all", group: "Compose", needsCurrent: true },
  { id: "forward", keys: ["f"], label: "Forward", group: "Compose", needsCurrent: true },
  { id: "ai-write", keys: ["w"], label: "Write with AI", group: "Compose", needsCurrent: true },

  // Splits
  { id: "split-1", keys: ["1"], label: "Jump to split 1", group: "Split Inbox" },
  { id: "split-2", keys: ["2"], label: "Jump to split 2", group: "Split Inbox" },
  { id: "split-3", keys: ["3"], label: "Jump to split 3", group: "Split Inbox" },
  { id: "split-4", keys: ["4"], label: "Jump to split 4", group: "Split Inbox" },

  // AI
  { id: "ask", keys: ["mod+j"], label: "Ask AI about your inbox", group: "AI" },
  { id: "summarize", keys: ["mod+i"], label: "Summarize conversation", group: "AI", needsCurrent: true },

  // Global
  { id: "undo", keys: ["mod+z"], label: "Undo last action", group: "Global" },
  { id: "redo", keys: ["mod+shift+z"], label: "Redo last undone action", group: "Global" },
  { id: "escape", keys: ["Escape"], label: "Close / dismiss", group: "Global" },
];

// Normalize a keyboard event into a registry key token.
export function eventToKey(e: KeyboardEvent): string {
  const mod = e.metaKey || e.ctrlKey;
  let key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // Shift + a letter is a distinct binding (e.g. Shift+U = mark unread). Symbols
  // typed via Shift (e.g. "!", "#", "?") keep their literal character.
  if (e.shiftKey && /^[a-z]$/.test(key)) key = `shift+${key}`;
  return mod ? `mod+${key}` : key;
}

// Render a chord/key list as a human label, e.g. ["g","i"] -> "G then I".
export function renderKeys(keys: string[]): string {
  const pretty = (k: string) => {
    if (k.startsWith("shift+")) return "⇧" + k.slice(6).toUpperCase();
    return k
      .replace("mod+", "⌘/Ctrl+")
      .replace("shift+", "⇧")
      .replace("Enter", "↵")
      .replace("Escape", "Esc")
      .replace(/^([a-z])$/, (m) => m.toUpperCase());
  };
  if (keys.length === 1) return pretty(keys[0]);
  return keys.map(pretty).join(" then ");
}

export function shortcutsByGroup(
  shortcuts: ShortcutDef[] = SHORTCUTS
): Record<string, ShortcutDef[]> {
  const out: Record<string, ShortcutDef[]> = {};
  for (const s of shortcuts) {
    (out[s.group] ??= []).push(s);
  }
  return out;
}

// A tiny chord matcher: feed it keys; it resolves a multi-key sequence (like
// "g i") within a timeout, or a single-key/mod shortcut immediately.
export interface ChordState {
  pending: string | null; // the held prefix key, e.g. "g"
  at: number; // timestamp of the prefix press
}

export const CHORD_PREFIXES = ["g"];
export const CHORD_TIMEOUT_MS = 1200;

// Resolve an incoming key against the registry + any pending chord prefix.
// Returns the matched shortcut id (or null) plus the next chord state. The
// registry is injectable so the app can pass a user-customized (remapped)
// effective shortcut list; it defaults to the built-in SHORTCUTS.
export function resolveKey(
  key: string,
  state: ChordState,
  now: number,
  shortcuts: ShortcutDef[] = SHORTCUTS
): { id: string | null; next: ChordState } {
  // Continue a pending chord if still within the timeout window.
  if (state.pending && now - state.at <= CHORD_TIMEOUT_MS) {
    const combo = [state.pending, key];
    const match = shortcuts.find(
      (s) => s.keys.length === 2 && s.keys[0] === combo[0] && s.keys[1] === combo[1]
    );
    return { id: match?.id ?? null, next: { pending: null, at: 0 } };
  }
  // Start a new chord if this key is a known prefix.
  if (CHORD_PREFIXES.includes(key)) {
    return { id: null, next: { pending: key, at: now } };
  }
  // Otherwise match a single-key / mod shortcut.
  const match = shortcuts.find((s) => s.keys.length === 1 && s.keys[0] === key);
  return { id: match?.id ?? null, next: { pending: null, at: 0 } };
}
