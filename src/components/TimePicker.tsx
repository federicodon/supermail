import { useMemo, useState } from "react";
import {
  parseNaturalTime,
  presetSubtitle,
  type TimePreset,
} from "../lib/naturalTime";

// Preset buttons (with their resolved clock time shown) plus a free-text
// natural-language field — "tomorrow 9am", "next tue", "in 3 days" — with a live
// preview. Shared by Snooze, Remind Me, and Send Later.
export function TimePicker({
  presets,
  onPick,
  placeholder = "Or type a time… “next tue 9am”, “in 3 days”",
}: {
  presets: TimePreset[];
  onPick: (at: Date, label: string) => void;
  placeholder?: string;
}) {
  // Capture an anchor when the picker opens so subtitles are stable.
  const anchor = useMemo(() => Date.now(), []);
  const [text, setText] = useState("");
  const parsed = useMemo(
    () => (text.trim() ? parseNaturalTime(text, Date.now()) : null),
    [text]
  );

  const commit = (at: Date, label: string) => {
    setText("");
    onPick(at, label);
  };

  return (
    <div className="timepicker">
      {presets.map((p) => (
        <button
          key={p.id}
          className="timepreset"
          onClick={() => commit(p.resolve(Date.now()), p.label)}
        >
          <span>{p.label}</span>
          <span className="timepreset-sub">{presetSubtitle(p, anchor)}</span>
        </button>
      ))}
      <div className="timepicker-custom">
        <input
          autoFocus
          aria-label="Custom time"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && parsed) {
              e.preventDefault();
              commit(parsed.at, parsed.label);
            }
          }}
        />
        {text.trim() &&
          (parsed ? (
            <button
              className="timepicker-go"
              onClick={() => commit(parsed.at, parsed.label)}
            >
              → {parsed.label}
            </button>
          ) : (
            <span className="timepicker-miss">Couldn’t read that time</span>
          ))}
      </div>
    </div>
  );
}

// Remind Me picker: a TimePicker plus the Superhuman "only if no reply"
// follow-up safety net.
export function RemindPicker({
  presets,
  onPick,
}: {
  presets: TimePreset[];
  onPick: (at: Date, label: string, ifNoReply: boolean) => void;
}) {
  const [ifNoReply, setIfNoReply] = useState(false);
  return (
    <div>
      <label className="remind-toggle">
        <input
          type="checkbox"
          checked={ifNoReply}
          onChange={(e) => setIfNoReply(e.target.checked)}
        />
        Only remind me if no one replies (follow-up safety net)
      </label>
      <TimePicker presets={presets} onPick={(at, label) => onPick(at, label, ifNoReply)} />
    </div>
  );
}
