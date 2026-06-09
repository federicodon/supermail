import type { ShortcutDef } from "../types";
import { SHORTCUTS, renderKeys } from "./shortcuts";

export interface ShortcutDrill {
  id: string;
  label: string;
  group: string;
  keys: string[];
  prompt: string;
  priority: number;
}

export type ShortcutScore = "pending" | "partial" | "correct" | "wrong";

export interface ShortcutAttempt {
  id: string;
  correct: boolean;
}

const COACH_PRIORITY: Record<string, number> = {
  archive: 100,
  reply: 96,
  "reply-all": 92,
  compose: 88,
  snooze: 84,
  search: 80,
  "next-conversation": 76,
  "prev-conversation": 72,
  "goto-inbox": 68,
  "goto-today": 64,
  palette: 60,
  undo: 56,
};

function promptForShortcut(s: ShortcutDef): string {
  const keyText = s.keys.length ? renderKeys(s.keys) : "Command palette";
  return `${s.label} -> ${keyText}`;
}

export function buildShortcutDrills(
  shortcuts: ShortcutDef[] = SHORTCUTS,
  limit = 12
): ShortcutDrill[] {
  return shortcuts
    .filter((s) => s.keys.length > 0)
    .map((s) => ({
      id: s.id,
      label: s.label,
      group: s.group,
      keys: s.keys,
      prompt: promptForShortcut(s),
      priority: COACH_PRIORITY[s.id] ?? 0,
    }))
    .sort((a, b) => b.priority - a.priority || a.group.localeCompare(b.group) || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, limit));
}

export function scoreShortcutAttempt(drill: Pick<ShortcutDrill, "keys">, attempt: string[]): ShortcutScore {
  if (attempt.length === 0) return "pending";
  if (attempt.length > drill.keys.length) return "wrong";
  for (let i = 0; i < attempt.length; i += 1) {
    if (attempt[i] !== drill.keys[i]) return "wrong";
  }
  return attempt.length === drill.keys.length ? "correct" : "partial";
}

export function nextDrillIndex(drills: ShortcutDrill[], currentIndex: number, attempts: ShortcutAttempt[]): number {
  if (drills.length === 0) return 0;
  const mastered = new Set(attempts.filter((a) => a.correct).map((a) => a.id));
  for (let offset = 1; offset <= drills.length; offset += 1) {
    const idx = (currentIndex + offset) % drills.length;
    if (!mastered.has(drills[idx].id)) return idx;
  }
  return (currentIndex + 1) % drills.length;
}

export function shortcutPracticeStats(attempts: ShortcutAttempt[]) {
  const attempted = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  let streak = 0;
  for (let i = attempts.length - 1; i >= 0; i -= 1) {
    if (!attempts[i].correct) break;
    streak += 1;
  }
  return {
    attempted,
    correct,
    missed: attempted - correct,
    accuracy: attempted === 0 ? 0 : Math.round((correct / attempted) * 100),
    streak,
  };
}
