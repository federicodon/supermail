import { useEffect, useMemo, useRef, useState } from "react";
import type { Email } from "../types";
import { renderKeys } from "../lib/shortcuts";

export interface Command {
  id: string;
  label: string;
  run: () => void;
  keys?: string[]; // optional shortcut hint
  group?: string;
  disabled?: boolean;
  // Quick-switcher entries (jump to a person/label/conversation): only surfaced
  // once the user types, so the default palette stays tidy.
  searchOnly?: boolean;
}

// Lightweight fuzzy score: subsequence match with bonuses for word-starts and
// contiguous runs. Returns null when the query isn't a subsequence.
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  let score = 0;
  let ti = 0;
  let prevMatch = -2;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    score += 1;
    if (found === prevMatch + 1) score += 2; // contiguous
    if (found === 0 || /\s/.test(t[found - 1])) score += 3; // word start
    prevMatch = found;
    ti = found + 1;
  }
  // Prefer shorter targets and earlier first matches.
  return score - t.length * 0.01;
}

export function CommandPalette({
  commands,
  current,
  recentIds = [],
  onClose,
}: {
  commands: Command[];
  current?: Email;
  recentIds?: string[];
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const filtered = useMemo(() => {
    if (!q.trim()) {
      // No query: show recents first, then declared order. Quick-switcher entries
      // (jump to a conversation / person) stay hidden so the palette is tidy.
      const rank = (id: string) => {
        const r = recentIds.indexOf(id);
        return r === -1 ? recentIds.length + 1 : r;
      };
      return commands.filter((c) => !c.searchOnly).slice().sort((a, b) => rank(a.id) - rank(b.id));
    }
    // Typing reveals the quick-switcher. A small penalty keeps real commands just
    // above jump targets at comparable scores, while a strong name/subject match
    // still wins.
    return commands
      .map((c) => {
        const s = fuzzyScore(q, c.label);
        return s === null ? null : { c, s: s - (c.searchOnly ? 0.5 : 0) };
      })
      .filter((x): x is { c: Command; s: number } => x !== null)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [commands, q, recentIds]);

  useEffect(() => {
    if (i >= filtered.length) setI(0);
  }, [filtered.length, i]);

  const runAt = (idx: number) => {
    const c = filtered[idx];
    if (c && !c.disabled) {
      c.run();
      onClose();
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Type a command, or a name / subject to jump…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setI((x) => Math.min(x + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setI((x) => Math.max(x - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              runAt(i);
            } else if (e.key === "Escape") onClose();
          }}
        />
        {current && <div className="palette-context">On: {current.subject}</div>}
        <ul className="palette-list">
          {filtered.map((c, idx) => (
            <li
              key={c.id}
              className={`${idx === i ? "active" : ""} ${c.disabled ? "disabled" : ""}`}
              onMouseEnter={() => setI(idx)}
              onClick={() => runAt(idx)}
            >
              <span className="cmd-label">
                {c.group && <span className="cmd-group">{c.group}</span>}
                {c.label}
              </span>
              {c.keys && <kbd className="cmd-keys">{renderKeys(c.keys)}</kbd>}
            </li>
          ))}
          {filtered.length === 0 && <li className="muted">No matching command</li>}
        </ul>
      </div>
    </div>
  );
}
