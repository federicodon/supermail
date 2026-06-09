import { useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ShortcutDef } from "../types";
import { eventToKey, renderKeys, shortcutsByGroup, SHORTCUTS } from "../lib/shortcuts";
import {
  buildShortcutDrills,
  nextDrillIndex,
  scoreShortcutAttempt,
  shortcutPracticeStats,
  type ShortcutAttempt,
} from "../lib/shortcutCoach";

// Searchable, grouped shortcut reference derived entirely from the shortcut
// registry so it can never drift from the live key handler / command palette.
// Accepts the *effective* (user-remapped) registry so the reference always shows
// the keys that are actually live.
export function ShortcutsGuide({
  onClose,
  shortcuts = SHORTCUTS,
}: {
  onClose: () => void;
  shortcuts?: ShortcutDef[];
}) {
  const [q, setQ] = useState("");
  const [attempt, setAttempt] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<ShortcutAttempt[]>([]);
  const [feedback, setFeedback] = useState<string>("");
  const [drillIndex, setDrillIndex] = useState(0);
  const groups = useMemo(() => shortcutsByGroup(shortcuts), [shortcuts]);
  const drills = useMemo(() => buildShortcutDrills(shortcuts, 12), [shortcuts]);
  const activeDrill = drills[drillIndex] ?? drills[0];
  const stats = useMemo(() => shortcutPracticeStats(attempts), [attempts]);
  const term = q.trim().toLowerCase();

  const recordAttempt = (correct: boolean, attemptedKeys: string[]) => {
    if (!activeDrill) return;
    const nextAttempts = [...attempts, { id: activeDrill.id, correct }];
    setAttempts(nextAttempts);
    setDrillIndex(nextDrillIndex(drills, drillIndex, nextAttempts));
    setAttempt([]);
    setFeedback(correct ? "Correct" : `Missed: ${renderKeys(activeDrill.keys)}`);
    if (!correct && attemptedKeys.length) {
      setFeedback(`Missed: ${renderKeys(activeDrill.keys)}`);
    }
  };

  const onPracticeKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (!activeDrill) return;
    if (e.key === "Escape") {
      setAttempt([]);
      setFeedback("");
      return;
    }
    if (e.key === "Shift" || e.key === "Meta" || e.key === "Control" || e.key === "Alt") return;
    const nextAttempt = [...attempt, eventToKey(e.nativeEvent)];
    const score = scoreShortcutAttempt(activeDrill, nextAttempt);
    if (score === "partial") {
      setAttempt(nextAttempt);
      setFeedback("Continue");
      return;
    }
    if (score === "correct") {
      recordAttempt(true, nextAttempt);
      return;
    }
    recordAttempt(false, nextAttempt);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="shortcuts" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-head">
          <h3>Keyboard shortcuts</h3>
          <input
            autoFocus
            className="shortcuts-search"
            placeholder="Filter shortcuts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {activeDrill && (
          <section className="shortcut-coach">
            <div className="coach-top">
              <div>
                <span className="coach-eyebrow">Speed coach</span>
                <strong>{activeDrill.label}</strong>
              </div>
              <span className="coach-score">
                {stats.correct}/{stats.attempted || 0} · {stats.accuracy}% · streak {stats.streak}
              </span>
            </div>
            <div className="coach-body">
              <span className="coach-prompt">{activeDrill.group}</span>
              <input
                className="coach-input"
                readOnly
                placeholder="Type shortcut"
                value={attempt.map((k) => renderKeys([k])).join(" then ")}
                onKeyDown={onPracticeKey}
              />
              <button type="button" onClick={() => setFeedback(renderKeys(activeDrill.keys))}>
                Reveal
              </button>
              <button type="button" onClick={() => recordAttempt(false, [])}>
                Skip
              </button>
              <button
                type="button"
                disabled={attempts.length === 0}
                onClick={() => {
                  setAttempts([]);
                  setAttempt([]);
                  setFeedback("");
                  setDrillIndex(0);
                }}
              >
                Reset
              </button>
            </div>
            {feedback && <div className="coach-feedback">{feedback}</div>}
          </section>
        )}
        <div className="shortcuts-grid">
          {Object.entries(groups).map(([group, list]) => {
            const items = list.filter(
              (s) =>
                s.keys.length > 0 &&
                (!term ||
                  s.label.toLowerCase().includes(term) ||
                  renderKeys(s.keys).toLowerCase().includes(term))
            );
            if (!items.length) return null;
            return (
              <section key={group} className="shortcuts-group">
                <h4>{group}</h4>
                <table>
                  <tbody>
                    {items.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <kbd>{renderKeys(s.keys)}</kbd>
                        </td>
                        <td>{s.label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>
        <div className="shortcuts-foot">
          <span className="muted">Tip: press keys in sequence for chords, e.g. G then I → Inbox.</span>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
