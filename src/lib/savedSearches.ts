import type { Email, SavedSearch } from "../types";
import { searchQuery } from "./search";

// Saved searches / smart views.
//
// A named query (in the search.ts query language) that runs across the whole
// mailbox and lives in the sidebar — Superhuman's "saved searches". Pure list
// math + a query runner, kept React-free so it's unit-testable.

let seq = 0;
function nextId(): string {
  seq += 1;
  return `ss-${seq}`;
}

// A few genuinely useful starter views that aren't already first-class folders.
export const DEFAULT_SAVED_SEARCHES: SavedSearch[] = [
  {
    id: "ss-unread",
    name: "Unread",
    query: "is:unread",
    icon: "●",
    pinned: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "ss-attachments",
    name: "Has attachment",
    query: "has:attachment",
    icon: "📎",
    createdAt: "2026-01-01T00:00:01.000Z",
  },
  {
    id: "ss-recent",
    name: "Last 7 days",
    query: "after:7d",
    icon: "🕒",
    createdAt: "2026-01-01T00:00:02.000Z",
  },
  {
    id: "ss-meeting",
    name: "Scheduling requests",
    query: "is:meeting",
    icon: "📅",
    createdAt: "2026-01-01T00:00:03.000Z",
  },
  {
    id: "ss-actionable",
    name: "Needs an action",
    query: "is:actionable",
    icon: "✅",
    createdAt: "2026-01-01T00:00:04.000Z",
  },
  {
    id: "ss-committed",
    name: "Promised",
    query: "is:committed",
    icon: "🤝",
    createdAt: "2026-01-01T00:00:05.000Z",
  },
];

export function createSavedSearch(
  name: string,
  query: string,
  nowIso: string,
  icon?: string
): SavedSearch {
  const q = query.trim();
  return {
    id: nextId(),
    name: (name.trim() || q),
    query: q,
    icon,
    createdAt: nowIso,
  };
}

// Add a saved search, de-duplicating by normalized query (a re-save replaces).
export function addSavedSearch(list: SavedSearch[], s: SavedSearch): SavedSearch[] {
  const q = s.query.trim().toLowerCase();
  if (!q) return list;
  const without = list.filter((x) => x.query.trim().toLowerCase() !== q);
  return [...without, s];
}

export function removeSavedSearch(list: SavedSearch[], id: string): SavedSearch[] {
  return list.filter((s) => s.id !== id);
}

export function renameSavedSearch(
  list: SavedSearch[],
  id: string,
  name: string
): SavedSearch[] {
  const trimmed = name.trim();
  return list.map((s) => (s.id === id ? { ...s, name: trimmed || s.name } : s));
}

export function togglePinned(list: SavedSearch[], id: string): SavedSearch[] {
  return list.map((s) => (s.id === id ? { ...s, pinned: !s.pinned } : s));
}

// Find an existing saved search whose query matches (normalized).
export function findByQuery(
  list: SavedSearch[],
  query: string
): SavedSearch | undefined {
  const q = query.trim().toLowerCase();
  return list.find((s) => s.query.trim().toLowerCase() === q);
}

// Pinned first, then oldest-first by creation time.
export function orderedSavedSearches(list: SavedSearch[]): SavedSearch[] {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

// Run a saved search across the mailbox (Trash excluded by default, matching
// Gmail's behavior unless the query explicitly asks for in:all etc.).
export function runSavedSearch(
  emails: Email[],
  s: SavedSearch,
  now: number
): Email[] {
  const base = s.query.toLowerCase().includes("in:all")
    ? emails
    : emails.filter((e) => !e.trashed);
  return searchQuery(base, s.query, now);
}

// Number of messages matching a saved search (for a sidebar badge).
export function savedSearchCount(
  emails: Email[],
  s: SavedSearch,
  now: number
): number {
  return runSavedSearch(emails, s, now).length;
}

// Number of *unread* messages matching a saved search.
export function savedSearchUnreadCount(
  emails: Email[],
  s: SavedSearch,
  now: number
): number {
  return runSavedSearch(emails, s, now).filter((e) => !e.read).length;
}
