import type {
  BlockEntry,
  Draft,
  Email,
  Label,
  OutboxItem,
  SavedSearch,
  Snippet,
  SplitInbox,
} from "../types";
import type { Account } from "./accounts";
import type { NoteMap } from "./notes";
import { type VipMap, sanitizeVips } from "./vips";
import type { Personalization } from "./personalization";
import type { Keymap } from "./keymap";

// Local-first persistence.
//
// SuperMail keeps the whole working set (triage state, split config, snippets,
// outbox, settings, light UI prefs) in the browser's localStorage so the app
// feels real across reloads — the way Superhuman keeps your inbox state. Nothing
// here ever leaves the device.
//
// The module is written against a tiny KV interface so it is fully unit-testable
// without a real browser, and every read is defensive: corrupt or stale blobs
// are ignored, never thrown, so a bad write can't brick the app.

export const STORAGE_KEY = "supermail.state";
// Bump when the persisted shape changes incompatibly; older blobs are dropped.
export const STORAGE_VERSION = 2;

// User-tunable settings (edited in Settings; see Slice 10).
export interface AppSettings {
  signature: string;
  undoWindowMs: number;
  autoAdvance: boolean; // jump to next conversation after triage
  density: "comfortable" | "compact";
  theme: string; // theme id from src/lib/theme.ts
  accent: string; // accent override token ("" = theme default)
  selfName: string;
  selfEmail: string;
  readReceipts: boolean; // surface placeholder read-status UI
  confirmArchiveAll: boolean;
  // When on, sending a reply also archives the conversation (Superhuman's
  // reply-and-move-on flow). The explicit "Send & Archive" button always does.
  sendAndArchive: boolean;
  // When on, every reply is pre-armed with a "remind me if no reply" follow-up
  // (the composer toggle starts checked) so you never silently drop the ball.
  // See src/lib/reminders.ts (DEFAULT_FOLLOW_UP_MS).
  autoFollowUp: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  signature: "Best,\nFederico",
  undoWindowMs: 10_000,
  autoAdvance: true,
  density: "comfortable",
  theme: "superhuman",
  accent: "",
  selfName: "Federico Donatone",
  selfEmail: "federicodonatone1@gmail.com",
  readReceipts: true,
  confirmArchiveAll: false,
  sendAndArchive: false,
  autoFollowUp: false,
};

// Light UI preferences worth remembering between sessions.
export interface UiPrefs {
  recentCmds: string[];
  activeSplitId: string;
  // Which account scope is selected ("all" or an account id). See accounts.ts.
  activeAccountId: string;
}

export interface PersistedState {
  version: number;
  emails?: Email[];
  splits?: SplitInbox[];
  // User labels (create / rename / recolor / delete in-app). System labels are
  // not stored here.
  labels?: Label[];
  outbox?: OutboxItem[];
  drafts?: Draft[];
  snippets?: Snippet[];
  savedSearches?: SavedSearch[];
  blocks?: BlockEntry[];
  // Connected accounts — persisted so per-account signature edits survive a
  // reload (the account *set* itself is still static in this build).
  accounts?: Account[];
  personalization?: Personalization;
  settings?: Partial<AppSettings>;
  ui?: Partial<UiPrefs>;
  // User keyboard remapping overlay (shortcut id -> custom key tokens).
  keymap?: Keymap;
  // Private per-conversation notes (threadId -> text). Local only, never sent.
  notes?: NoteMap;
  // Private per-person notes (normalized-email -> text). Local only, never sent.
  contactNotes?: NoteMap;
  // Manual VIP overrides (normalized-email -> forced VIP on/off). See vips.ts.
  vips?: VipMap;
  savedAt?: string;
}

// Minimal storage surface so tests can inject an in-memory store.
export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// In-memory KV used by tests (and as a no-op fallback when storage is absent).
export class MemoryKV implements KVStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

// Resolve a usable store: the real localStorage in a browser, else a throwaway.
export function defaultStore(): KVStore {
  try {
    const ls = (globalThis as { localStorage?: KVStore }).localStorage;
    if (ls && typeof ls.getItem === "function") return ls;
  } catch {
    /* access can throw in sandboxed iframes */
  }
  return new MemoryKV();
}

// ---- Validation ------------------------------------------------------------

function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

// Defensive shape check: only keeps fields that look right, so a partially
// corrupt blob still yields whatever is salvageable.
export function sanitize(raw: unknown): PersistedState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== STORAGE_VERSION) return null;
  const out: PersistedState = { version: STORAGE_VERSION };
  if (isArray(o.emails)) out.emails = o.emails as Email[];
  if (isArray(o.splits)) out.splits = o.splits as SplitInbox[];
  if (isArray(o.labels)) out.labels = o.labels as Label[];
  if (isArray(o.outbox)) out.outbox = o.outbox as OutboxItem[];
  if (isArray(o.drafts)) out.drafts = o.drafts as Draft[];
  if (isArray(o.snippets)) out.snippets = o.snippets as Snippet[];
  if (isArray(o.savedSearches)) out.savedSearches = o.savedSearches as SavedSearch[];
  if (isArray(o.blocks)) out.blocks = o.blocks as BlockEntry[];
  if (isArray(o.accounts)) out.accounts = o.accounts as Account[];
  if (o.personalization && typeof o.personalization === "object")
    out.personalization = o.personalization as Personalization;
  if (o.settings && typeof o.settings === "object")
    out.settings = o.settings as Partial<AppSettings>;
  if (o.ui && typeof o.ui === "object") out.ui = o.ui as Partial<UiPrefs>;
  if (o.keymap && typeof o.keymap === "object" && !isArray(o.keymap))
    out.keymap = o.keymap as Keymap;
  if (o.notes && typeof o.notes === "object" && !isArray(o.notes))
    out.notes = o.notes as NoteMap;
  if (o.contactNotes && typeof o.contactNotes === "object" && !isArray(o.contactNotes))
    out.contactNotes = o.contactNotes as NoteMap;
  if (o.vips && typeof o.vips === "object" && !isArray(o.vips))
    out.vips = sanitizeVips(o.vips);
  if (typeof o.savedAt === "string") out.savedAt = o.savedAt;
  return out;
}

// ---- Public API ------------------------------------------------------------

export function loadState(store: KVStore = defaultStore()): PersistedState | null {
  try {
    const text = store.getItem(STORAGE_KEY);
    if (!text) return null;
    return sanitize(JSON.parse(text));
  } catch {
    return null;
  }
}

export function saveState(
  partial: Omit<PersistedState, "version" | "savedAt">,
  store: KVStore = defaultStore(),
  nowIso?: string
): boolean {
  try {
    const blob: PersistedState = {
      version: STORAGE_VERSION,
      ...partial,
      savedAt: nowIso ?? new Date().toISOString(),
    };
    store.setItem(STORAGE_KEY, JSON.stringify(blob));
    return true;
  } catch {
    // Quota exceeded / serialization failure — fail soft, never crash the app.
    return false;
  }
}

export function clearState(store: KVStore = defaultStore()): void {
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

// Merge a persisted settings fragment onto the defaults so new settings keys
// always have a value even when an older blob is loaded.
export function resolveSettings(persisted?: Partial<AppSettings>): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(persisted ?? {}) };
}

// ---- Export / import (local backup & migrate) ------------------------------
//
// A power user can download their whole working set as JSON and restore it
// later or on another machine. The snapshot contains ONLY local data (triage
// state, splits, snippets, settings, notes…) — no OAuth tokens, client secrets,
// passwords or any credential is ever persisted, so the file is safe to keep.

// Pretty-printed JSON snapshot suitable for a file download.
export function serializeState(
  partial: Omit<PersistedState, "version" | "savedAt">,
  nowIso?: string
): string {
  const blob: PersistedState = {
    version: STORAGE_VERSION,
    ...partial,
    savedAt: nowIso ?? new Date().toISOString(),
  };
  return JSON.stringify(blob, null, 2);
}

// Parse an imported JSON string back into a validated PersistedState, or null
// if it's not valid JSON / not a matching version. Reuses the same defensive
// `sanitize`, so a hand-edited or foreign file can never inject a bad shape.
export function parseImportedState(json: string): PersistedState | null {
  try {
    return sanitize(JSON.parse(json));
  } catch {
    return null;
  }
}

// ---- Merge import (combine a backup instead of replacing) ------------------
//
// Replacing on import is destructive — it throws away anything in the current
// device that isn't in the file. A *merge* lets a power user pull a backup (or
// another machine's data) in additively. Semantics: the imported copy wins on
// any per-item conflict (same email/label/snippet id, same note/VIP key), but
// nothing that exists only on the current device is lost.

// Union two id-keyed arrays: every item from either side, the imported copy
// winning on a key collision; current order is preserved, imported-only items
// appended in their own order.
export function mergeById<T>(
  current: T[] | undefined,
  imported: T[] | undefined,
  keyOf: (t: T) => string
): T[] | undefined {
  if (!current) return imported;
  if (!imported) return current;
  const byKey = new Map<string, T>();
  const order: string[] = [];
  for (const item of current) {
    const k = keyOf(item);
    if (!byKey.has(k)) order.push(k);
    byKey.set(k, item);
  }
  for (const item of imported) {
    const k = keyOf(item);
    if (!byKey.has(k)) order.push(k);
    byKey.set(k, item); // imported wins on conflict
  }
  return order.map((k) => byKey.get(k)!);
}

// Shallow-union two string-keyed maps / object fragments; imported wins per key.
function mergeObject<T extends object>(current: T | undefined, imported: T | undefined): T | undefined {
  if (!current) return imported;
  if (!imported) return current;
  return { ...current, ...imported };
}

// Merge an imported snapshot INTO the current state (both assumed sanitized).
// The result is always stamped with the live STORAGE_VERSION.
export function mergeStates(current: PersistedState, imported: PersistedState): PersistedState {
  return {
    version: STORAGE_VERSION,
    emails: mergeById(current.emails, imported.emails, (e) => e.id),
    splits: mergeById(current.splits, imported.splits, (s) => s.id),
    labels: mergeById(current.labels, imported.labels, (l) => l.id),
    outbox: mergeById(current.outbox, imported.outbox, (o) => o.id),
    drafts: mergeById(current.drafts, imported.drafts, (d) => d.id),
    snippets: mergeById(current.snippets, imported.snippets, (s) => s.id),
    savedSearches: mergeById(current.savedSearches, imported.savedSearches, (s) => s.id),
    blocks: mergeById(current.blocks, imported.blocks, (b) => b.value),
    accounts: mergeById(current.accounts, imported.accounts, (a) => a.id),
    personalization: mergeObject(current.personalization, imported.personalization),
    settings: mergeObject(current.settings, imported.settings),
    ui: mergeObject(current.ui, imported.ui),
    keymap: mergeObject(current.keymap, imported.keymap),
    notes: mergeObject(current.notes, imported.notes),
    contactNotes: mergeObject(current.contactNotes, imported.contactNotes),
    vips: mergeObject(current.vips, imported.vips),
  };
}
