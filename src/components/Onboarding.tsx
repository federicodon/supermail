import { useState } from "react";
import { renderKeys } from "../lib/shortcuts";

interface Step {
  title: string;
  body: string;
  practice?: string[]; // shortcut key-tokens to highlight
}

const STEPS: Step[] = [
  {
    title: "Welcome to SuperMail",
    body: "A keyboard-first, local-first inbox for power users. This 60-second tour covers the moves that make you fast. You can reopen it anytime from the command palette.",
  },
  {
    title: "Move and triage without the mouse",
    body: "J/K (or arrows) move through the list, Enter opens, U goes back. E archives, S stars, H snoozes, R replies.",
    practice: [["j"], ["k"], ["e"], ["s"]].map((k) => k[0]),
  },
  {
    title: "Jump anywhere with G-chords",
    body: "Press G then a letter to navigate: G then I → Inbox, G then R → Reminders, G then O → Outbox, G then , → Settings.",
    practice: ["g"],
  },
  {
    title: "Command everything",
    body: "Press ⌘K / Ctrl+K for the command palette — fuzzy-search every action with its shortcut. Press ? anytime for the full shortcut reference.",
    practice: ["mod+k"],
  },
  {
    title: "Split Inbox + AI",
    body: "Your inbox is split into focused lanes (Important, Other, News, Social… plus a library you can enable). Press ⌘J to ask AI about your inbox, ⌘I to summarize a thread, W to write with AI.",
    practice: ["mod+j", "mod+i"],
  },
];

export function Onboarding({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="overlay">
      <div className="onboarding" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-progress">
          {STEPS.map((_, idx) => (
            <span key={idx} className={`dot ${idx === i ? "on" : ""}`} />
          ))}
        </div>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        {step.practice && (
          <div className="practice">
            {step.practice.map((k) => (
              <kbd key={k}>{renderKeys([k])}</kbd>
            ))}
          </div>
        )}
        <div className="onboarding-actions">
          <button className="link" onClick={onClose}>Skip</button>
          {i > 0 && <button onClick={() => setI((x) => x - 1)}>Back</button>}
          {!last ? (
            <button className="primary" onClick={() => setI((x) => x + 1)}>Next</button>
          ) : (
            <button className="primary" onClick={onClose}>Start using SuperMail</button>
          )}
        </div>
      </div>
    </div>
  );
}
