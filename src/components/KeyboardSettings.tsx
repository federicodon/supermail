import { useMemo, useState } from "react";
import { eventToKey, renderKeys, shortcutsByGroup } from "../lib/shortcuts";
import {
  type Keymap,
  conflictFor,
  customizedCount,
  effectiveShortcuts,
  isRebindable,
  resetAll,
  resetBinding,
  setBinding,
} from "../lib/keymap";

// Customize your keyboard shortcuts (Superhuman-style). Lists every rebindable
// action grouped, shows its live key, and lets you capture a new one — with
// conflict detection so two actions can't silently share a key. Chords and a
// few engine-critical keys are intentionally fixed and hidden here.
export function KeyboardSettings({
  keymap,
  onChange,
}: {
  keymap: Keymap;
  onChange: (next: Keymap) => void;
}) {
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  const groups = useMemo(() => {
    const eff = effectiveShortcuts(keymap).filter(isRebindable);
    return shortcutsByGroup(eff);
  }, [keymap]);

  const customized = customizedCount(keymap);

  const capture = (id: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const k = e.key;
    if (k === "Escape") {
      setCapturingId(null);
      setWarn(null);
      return;
    }
    // Wait for a real key, not a bare modifier press.
    if (k === "Shift" || k === "Meta" || k === "Control" || k === "Alt") return;
    const token = eventToKey(e.nativeEvent);
    const clash = conflictFor(token, id, keymap);
    if (clash) {
      setWarn(`${renderKeys([token])} is already used by “${clash.label}”. Pick another key.`);
      return;
    }
    onChange(setBinding(keymap, id, token));
    setCapturingId(null);
    setWarn(null);
  };

  return (
    <section className="card">
      <div className="kb-head">
        <h3>Keyboard shortcuts</h3>
        <div className="kb-head-actions">
          {customized > 0 && (
            <span className="muted kb-count">{customized} customized</span>
          )}
          <button
            className="kb-resetall"
            disabled={customized === 0}
            onClick={() => {
              onChange(resetAll());
              setCapturingId(null);
              setWarn(null);
            }}
          >
            Reset all to defaults
          </button>
        </div>
      </div>
      <p className="hint muted">
        Click a shortcut to record a new key. Chords (e.g. <kbd>G</kbd> then <kbd>I</kbd>) and the
        command palette stay fixed so you can't lock yourself out. Press <kbd>Esc</kbd> while
        recording to cancel.
      </p>
      {warn && <div className="kb-warn">{warn}</div>}

      <div className="kb-groups">
        {Object.entries(groups).map(([group, list]) => (
          <div key={group} className="kb-group">
            <h4>{group}</h4>
            <ul className="kb-list">
              {list.map((s) => {
                const isCustom = !!keymap[s.id];
                const capturing = capturingId === s.id;
                return (
                  <li key={s.id} className="kb-row">
                    <span className="kb-label">{s.label}</span>
                    <span className="kb-keywrap">
                      {capturing ? (
                        <input
                          className="kb-capture"
                          autoFocus
                          readOnly
                          placeholder="Press a key…"
                          value=""
                          onKeyDown={(e) => capture(s.id, e)}
                          onBlur={() => {
                            setCapturingId(null);
                            setWarn(null);
                          }}
                        />
                      ) : (
                        <button
                          className="kb-key"
                          title="Click to rebind"
                          onClick={() => {
                            setWarn(null);
                            setCapturingId(s.id);
                          }}
                        >
                          {s.keys.length ? <kbd>{renderKeys(s.keys)}</kbd> : <span className="kb-unbound">Unbound</span>}
                        </button>
                      )}
                      {isCustom && !capturing && (
                        <button
                          className="kb-mini"
                          title="Reset to default"
                          onClick={() => onChange(resetBinding(keymap, s.id))}
                        >
                          ↺
                        </button>
                      )}
                      {s.keys.length > 0 && !capturing && (
                        <button
                          className="kb-mini"
                          title="Unbind (no key)"
                          onClick={() => onChange(setBinding(keymap, s.id, null))}
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
