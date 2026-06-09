import { useEffect, useRef, useState } from "react";
import type { AiAnswer, Email } from "../types";
import { askInbox } from "../lib/ai";

const SUGGESTIONS = [
  "Catch me up",
  "What needs my attention?",
  "What do I need to do?",
  "What did I promise?",
  "What's unread?",
  "What needs a reply?",
  "What am I waiting on?",
  "Any scheduling requests?",
  "What follow-ups do I have?",
  "Anything with attachments?",
  "What did Dana send?",
];

// "Ask AI about your inbox" — deterministic local Q&A over the mailbox. Answers
// cite the messages they drew from; clicking a source opens that thread.
export function AskPanel({
  emails,
  now,
  autoAsk,
  onOpenEmail,
  onClose,
}: {
  emails: Email[];
  now: number;
  autoAsk?: string;
  onOpenEmail: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [history, setHistory] = useState<{ q: string; a: AiAnswer }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const ask = (question: string) => {
    const query = question.trim();
    if (!query) return;
    const a = askInbox(emails, query, now);
    setHistory((h) => [...h, { q: query, a }]);
    setQ("");
  };

  // Auto-run an initial question (e.g. the "Catch me up" command) once on mount.
  const didAuto = useRef(false);
  useEffect(() => {
    if (autoAsk && !didAuto.current) {
      didAuto.current = true;
      ask(autoAsk);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAsk]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="ask-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ask-head">
          <h3>✦ Ask your inbox</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="ask-body">
          {history.length === 0 && (
            <div className="ask-empty">
              <p className="muted">Ask anything about your mail. Try:</p>
              <div className="ask-suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {history.map((h, idx) => (
            <div key={idx} className="ask-turn">
              <div className="ask-q">{h.q}</div>
              <div className="ask-a">
                {h.a.text}
                {h.a.local && <span className="ai-badge" title="Answered locally, no data left your device">local</span>}
                {!!h.a.sources?.length && (
                  <div className="ask-sources">
                    {h.a.sources.map((id) => {
                      const e = emails.find((m) => m.id === id);
                      if (!e) return null;
                      return (
                        <button key={id} className="source-chip" onClick={() => { onOpenEmail(id); onClose(); }}>
                          {e.from.name}: {e.subject}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="ask-input">
          <input
            ref={inputRef}
            placeholder="Ask about your inbox…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") ask(q);
              else if (e.key === "Escape") onClose();
            }}
          />
          <button onClick={() => ask(q)}>Ask</button>
        </div>
      </div>
    </div>
  );
}
