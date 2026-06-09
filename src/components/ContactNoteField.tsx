import { useEffect, useRef, useState } from "react";

// A compact, inline private note about a person — shared by the reader's sender
// insight card and the People profile so both stay in sync (they read/write the
// same persisted, account-agnostic contact-notes map). Local-only, never sent.
//
// Controlled by the parent (value + onSave, saved live on each keystroke);
// manages only its own edit/display toggle. Callers should pass a `key` of the
// contact's email so switching people resets the editor on remount.
export function ContactNoteField({
  note,
  firstName,
  onSave,
}: {
  note: string;
  firstName: string;
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) {
      const el = ref.current;
      el?.focus();
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  return (
    <div className="sender-note">
      {editing ? (
        <textarea
          ref={ref}
          className="note-input"
          value={note}
          placeholder={`Private note about ${firstName} — e.g. "prefers concise replies"…`}
          onChange={(e) => onSave(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            // Esc / Cmd+Enter finish; otherwise keep keystrokes out of the
            // app-wide keyboard engine while typing.
            if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
              e.preventDefault();
              e.stopPropagation();
              setEditing(false);
            } else {
              e.stopPropagation();
            }
          }}
        />
      ) : note ? (
        <button
          className="sender-note-show"
          onClick={() => setEditing(true)}
          title="Click to edit · private to you, never sent"
        >
          <span className="sender-note-tag">🏷</span> {note}
        </button>
      ) : (
        <button
          className="sender-note-add"
          onClick={() => setEditing(true)}
          title="Keep a private note about this person — local only, never sent"
        >
          🏷 Note about {firstName}
        </button>
      )}
    </div>
  );
}
