import type { ShortcutDef } from "../types";
import { SHORTCUTS } from "./shortcuts";

// User keyboard remapping (Superhuman-style "customize your shortcuts").
//
// A Keymap is a sparse overlay: shortcut id -> the custom key token(s) the user
// chose. Anything not present keeps its registry default, so the stored object
// stays tiny and round-trips cleanly through localStorage. An empty array means
// "explicitly unbound" (no key) — distinct from "no override".
//
// To keep the chord engine and core navigation safe, only single-token bindings
// are rebindable; chords (g-prefixed two-key sequences) and a handful of
// structural keys are locked so you can never lock yourself out of the app.

export type Keymap = Record<string, string[]>;

// Keys whose binding can't be changed (muscle-memory + engine-critical).
export const LOCKED_IDS = new Set([
  "palette", // Cmd/Ctrl+K — your escape hatch to everything
  "escape",
  "open",
  "back",
  "down",
  "up",
  "help",
]);

// Can this shortcut be rebound by the user? Chords stay fixed; locked ids stay
// fixed; everything else (including key-less actions like "remind", which can
// *gain* a key) is fair game.
export function isRebindable(def: ShortcutDef): boolean {
  if (LOCKED_IDS.has(def.id)) return false;
  if (def.keys.length >= 2) return false; // chords are fixed
  return true;
}

// Apply the overlay onto a base registry, returning a fresh effective list.
export function effectiveShortcuts(
  overrides: Keymap,
  base: ShortcutDef[] = SHORTCUTS
): ShortcutDef[] {
  return base.map((s) => (overrides[s.id] ? { ...s, keys: overrides[s.id] } : s));
}

// The effective key token(s) for an id (override if present, else default).
export function effectiveKeysFor(
  id: string,
  overrides: Keymap,
  base: ShortcutDef[] = SHORTCUTS
): string[] | undefined {
  return overrides[id] ?? base.find((s) => s.id === id)?.keys;
}

// Any *other* shortcut already bound to `key` in the effective map — drives the
// "X already uses that key" warning before a rebind is committed.
export function conflictFor(
  key: string,
  excludeId: string,
  overrides: Keymap,
  base: ShortcutDef[] = SHORTCUTS
): ShortcutDef | null {
  const eff = effectiveShortcuts(overrides, base);
  return (
    eff.find((s) => s.id !== excludeId && s.keys.length === 1 && s.keys[0] === key) ?? null
  );
}

// Set a binding. Passing the registry default removes the override (keeps the
// map minimal); passing null unbinds the action entirely (empty key list).
export function setBinding(
  overrides: Keymap,
  id: string,
  key: string | null,
  base: ShortcutDef[] = SHORTCUTS
): Keymap {
  const def = base.find((s) => s.id === id);
  if (!def || !isRebindable(def)) return overrides; // ignore locked/unknown
  const next = { ...overrides };
  if (key === null) {
    next[id] = [];
    return next;
  }
  if (def.keys.length === 1 && def.keys[0] === key) {
    delete next[id]; // back to default → drop the override
    return next;
  }
  next[id] = [key];
  return next;
}

// Drop a single override (revert that id to its default).
export function resetBinding(overrides: Keymap, id: string): Keymap {
  const next = { ...overrides };
  delete next[id];
  return next;
}

// Clear every override.
export function resetAll(): Keymap {
  return {};
}

// How many bindings the user has customized.
export function customizedCount(overrides: Keymap): number {
  return Object.keys(overrides).length;
}
