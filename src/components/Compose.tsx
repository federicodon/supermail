import { useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Draft, Snippet } from "../types";
import { writeWithAi, rephrase, REWRITE_MODES } from "../lib/ai";
import { DEFAULT_PERSONALIZATION, type Personalization } from "../lib/personalization";
import { expandAtCaret, expandSnippet, type SnippetContext } from "../lib/snippets";
import { SEND_LATER_SMART_PRESETS } from "../lib/naturalTime";
import { type Account, signatureFor } from "../lib/accounts";
import { swapSignature } from "../lib/signature";
import { composeChecks, hasBlockers, type ComposeCheck } from "../lib/composeChecks";
import { FOLLOW_UP_PRESETS, DEFAULT_FOLLOW_UP_MS } from "../lib/reminders";
import { TimePicker } from "./TimePicker";

// Which send the user attempted, so a held send can be re-run after review.
type PendingSend =
  | { kind: "send" }
  | { kind: "send-archive" }
  | { kind: "later"; ms: number; label: string };

export function Compose({
  draft,
  snippets,
  contacts = [],
  personalization = DEFAULT_PERSONALIZATION,
  accounts = [],
  fallbackSignature = "",
  onChange,
  onSend,
  onSendArchive,
  onScheduleSend,
  onSaveDraft,
  onClose,
  onRequestAvailability,
}: {
  draft: Draft;
  snippets: Snippet[];
  contacts?: string[];
  personalization?: Personalization;
  // Connected accounts the message can be sent from (multi-account identity).
  accounts?: Account[];
  // Global signature used when the chosen account defines none.
  fallbackSignature?: string;
  onChange: (d: Draft) => void;
  onSend: (d: Draft) => void;
  // Send and archive the conversation (replies only; Superhuman "move on").
  onSendArchive?: (d: Draft) => void;
  onScheduleSend: (d: Draft, ms: number, label: string) => void;
  onSaveDraft: (d: Draft) => void;
  onClose: () => void;
  // Returns a paste-ready "here are some times" block from the calendar.
  onRequestAvailability?: () => string;
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [showCc, setShowCc] = useState(!!draft.cc || !!draft.bcc);
  const [showLater, setShowLater] = useState(false);
  const [aiIntent, setAiIntent] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [showRewrite, setShowRewrite] = useState(false);
  // Pre-send guardrails: when a send attempt trips a check (no recipient, empty
  // subject, "you said attached but nothing is"…) we hold the send and show a
  // review bar instead of firing. `pending` records which send was attempted so
  // "Send anyway" re-runs it against the *current* draft (no stale snapshot).
  const [review, setReview] = useState<{ checks: ComposeCheck[]; pending: PendingSend } | null>(
    null,
  );

  // After a snippet expands we re-position the caret (e.g. to a {{cursor}}
  // marker). The textarea value is controlled, so apply it post-render.
  const pendingCaret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret.current != null && bodyRef.current) {
      const pos = pendingCaret.current;
      bodyRef.current.focus();
      bodyRef.current.setSelectionRange(pos, pos);
      pendingCaret.current = null;
    }
  }, [draft.body]);

  // Context for variable expansion: recipient (from "To"), the user's name.
  const snippetCtx = (): SnippetContext => ({
    recipientEmail: draft.to.split(/[,;]\s*/)[0]?.trim() || undefined,
    myName: personalization.name,
    now: Date.now(),
  });

  const insertSnippet = (s: Snippet) => {
    const { text } = expandSnippet(s.body, snippetCtx());
    onChange({ ...draft, body: (draft.body ? draft.body + "\n\n" : "") + text });
    bodyRef.current?.focus();
  };

  const runAi = () => {
    const { subject, body } = writeWithAi(aiIntent, draft.to, personalization);
    onChange({ ...draft, subject: draft.subject || subject, body });
    setShowAi(false);
    setAiIntent("");
    bodyRef.current?.focus();
  };

  const runRewrite = (mode: (typeof REWRITE_MODES)[number]["mode"]) => {
    if (draft.body.trim()) onChange({ ...draft, body: rephrase(draft.body, mode, personalization) });
    setShowRewrite(false);
    bodyRef.current?.focus();
  };

  // The account this message is sent from. Switching it follows the chosen
  // identity's signature into the body (handled by swapSignature, which leaves a
  // hand-edited sign-off and any quoted thread alone).
  const fromId = draft.fromAccountId ?? accounts[0]?.id ?? "";
  const changeFrom = (newId: string) => {
    const oldSig = signatureFor(accounts, fromId, fallbackSignature);
    const newSig = signatureFor(accounts, newId, fallbackSignature);
    onChange({ ...draft, fromAccountId: newId, body: swapSignature(draft.body, oldSig, newSig) });
  };

  // Keyboard-first compose (Superhuman "Compose Quickly"): ⌘/Ctrl+↵ sends from
  // anywhere in the composer; Esc backs out of an open sub-menu, then closes.
  // We stop propagation so these don't also reach the app-wide key engine.
  const isReply = Boolean(draft.inReplyTo) && Boolean(draft.threadId);

  // Actually fire the send — reads the *current* draft prop, so a "Send anyway"
  // after editing in the review bar uses the latest text.
  const execute = (pending: PendingSend) => {
    setReview(null);
    if (pending.kind === "send-archive" && isReply && onSendArchive) onSendArchive(draft);
    else if (pending.kind === "later") onScheduleSend(draft, pending.ms, pending.label);
    else onSend(draft);
  };

  // Gate every send through the pre-send checks. Clean → send immediately;
  // otherwise hold and surface the review bar (blockers can't be overridden).
  const guard = (pending: PendingSend) => {
    const checks = composeChecks(draft);
    if (checks.length === 0) {
      execute(pending);
      return;
    }
    setReview({ checks, pending });
  };

  const onComposeKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      // If the review bar is up, ⌘↵ confirms it (unless something blocks).
      if (review) {
        if (!hasBlockers(review.checks)) execute(review.pending);
        return;
      }
      // ⌘/Ctrl+Shift+↵ on a reply sends and archives the conversation.
      guard({ kind: e.shiftKey && isReply && onSendArchive ? "send-archive" : "send" });
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (review) {
        setReview(null);
      } else if (showAi || showLater || showRewrite) {
        setShowAi(false);
        setShowLater(false);
        setShowRewrite(false);
      } else {
        onClose();
      }
    }
  };

  // Contact autocomplete suggestions for the current "To" fragment.
  const toFragment = draft.to.split(/[,;]\s*/).pop() ?? "";
  const suggestions =
    toFragment.length >= 2
      ? contacts.filter((c) => c.toLowerCase().includes(toFragment.toLowerCase())).slice(0, 4)
      : [];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="compose" onClick={(e) => e.stopPropagation()} onKeyDown={onComposeKey}>
        <div className="compose-head">
          <span>{draft.inReplyTo ? "Reply" : "New message"}</span>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        {accounts.length > 1 && (
          <label className="compose-from">
            <span className="from-label">From</span>
            <select value={fromId} onChange={(e) => changeFrom(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.email}
                </option>
              ))}
            </select>
          </label>
        )}

        <input
          className="compose-field"
          placeholder="To"
          value={draft.to}
          onChange={(e) => onChange({ ...draft, to: e.target.value })}
        />
        {suggestions.length > 0 && (
          <div className="autocomplete">
            {suggestions.map((c) => (
              <button
                key={c}
                onClick={() => {
                  const parts = draft.to.split(/([,;]\s*)/);
                  parts[parts.length - 1] = c;
                  onChange({ ...draft, to: parts.join("") });
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {!showCc && (
          <button className="link cc-toggle" onClick={() => setShowCc(true)}>+ Cc / Bcc</button>
        )}
        {showCc && (
          <>
            <input
              className="compose-field"
              placeholder="Cc"
              value={draft.cc ?? ""}
              onChange={(e) => onChange({ ...draft, cc: e.target.value })}
            />
            <input
              className="compose-field"
              placeholder="Bcc"
              value={draft.bcc ?? ""}
              onChange={(e) => onChange({ ...draft, bcc: e.target.value })}
            />
          </>
        )}

        <input
          className="compose-field"
          placeholder="Subject"
          value={draft.subject}
          onChange={(e) => onChange({ ...draft, subject: e.target.value })}
        />

        <textarea
          ref={bodyRef}
          className="compose-body"
          placeholder="Write your message…  (type a snippet shortcut, e.g. ;intro)"
          value={draft.body}
          onChange={(e) => {
            const el = e.target;
            const caret = el.selectionStart ?? el.value.length;
            const res = expandAtCaret(el.value, caret, snippets, snippetCtx());
            if (res.expanded) pendingCaret.current = res.caret;
            onChange({ ...draft, body: res.body });
          }}
        />

        {showAi && (
          <div className="ai-intent">
            <input
              autoFocus
              placeholder="Describe the message, e.g. “ask Dana for the Q3 numbers”"
              value={aiIntent}
              onChange={(e) => setAiIntent(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAi()}
            />
            <button onClick={runAi}>Generate</button>
          </div>
        )}

        <div className="snippet-bar">
          <span className="muted">Snippets:</span>
          {snippets.map((s) => (
            <button key={s.id} className="snippet-chip" onClick={() => insertSnippet(s)}>
              {s.name} <code>{s.shortcut}</code>
            </button>
          ))}
        </div>

        {review && (
          <div className="send-review" role="alert">
            <div className="send-review-list">
              {review.checks.map((c) => (
                <div key={c.code} className={`send-review-item ${c.level}`}>
                  <span className="send-review-icon">{c.level === "block" ? "⛔" : "⚠"}</span>
                  {c.message}
                </div>
              ))}
            </div>
            <div className="send-review-actions">
              {!hasBlockers(review.checks) && (
                <button className="send" onClick={() => execute(review.pending)}>
                  Send anyway
                </button>
              )}
              <button className="link" onClick={() => setReview(null)}>
                {hasBlockers(review.checks) ? "OK" : "Keep editing"}
              </button>
            </div>
          </div>
        )}

        {isReply && (
          <label
            className="compose-followup"
            title="Place a 'remind me if no reply' follow-up on this conversation when the reply goes out"
          >
            <input
              type="checkbox"
              checked={draft.followUpMs != null}
              onChange={(e) =>
                onChange({ ...draft, followUpMs: e.target.checked ? DEFAULT_FOLLOW_UP_MS : null })
              }
            />
            <span>⏰ Remind me if no reply</span>
            <select
              value={draft.followUpMs ?? DEFAULT_FOLLOW_UP_MS}
              disabled={draft.followUpMs == null}
              onChange={(e) => onChange({ ...draft, followUpMs: Number(e.target.value) })}
            >
              {FOLLOW_UP_PRESETS.map((p) => (
                <option key={p.ms} value={p.ms}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="compose-actions">
          <button className="send" onClick={() => guard({ kind: "send" })} title="Send (⌘↵ / Ctrl+↵)">Send <kbd>⌘↵</kbd></button>
          {isReply && onSendArchive && (
            <button
              className="send-archive"
              onClick={() => guard({ kind: "send-archive" })}
              title="Send this reply and archive the conversation (⌘⇧↵)"
            >
              Send &amp; Archive <kbd>⌘⇧↵</kbd>
            </button>
          )}
          <div className="send-later-wrap">
            <button onClick={() => setShowLater((v) => !v)}>Send later ▾</button>
            {showLater && (
              <div className="send-later-menu">
                <TimePicker
                  presets={SEND_LATER_SMART_PRESETS}
                  placeholder="Or type when… “tomorrow 8am”, “mon 9am”, “in 2 hours”"
                  onPick={(at, label) => {
                    guard({ kind: "later", ms: at.getTime() - Date.now(), label });
                    setShowLater(false);
                  }}
                />
              </div>
            )}
          </div>
          <button onClick={() => setShowAi((v) => !v)}>✦ Write with AI</button>
          <div className="send-later-wrap">
            <button onClick={() => setShowRewrite((v) => !v)} title="Rewrite the draft with AI">✦ Rewrite ▾</button>
            {showRewrite && (
              <div className="send-later-menu">
                {REWRITE_MODES.map((m) => (
                  <button key={m.mode} title={m.hint} onClick={() => runRewrite(m.mode)}>
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {onRequestAvailability && (
            <button
              title="Insert open times from your calendar"
              onClick={() => {
                const block = onRequestAvailability();
                onChange({ ...draft, body: (draft.body ? draft.body + "\n\n" : "") + block });
                bodyRef.current?.focus();
              }}
            >
              📅 Insert availability
            </button>
          )}
          <button onClick={() => onSaveDraft(draft)} title="Saves a Gmail draft; you send manually">
            Save draft
          </button>
          <button onClick={onClose}>Discard</button>
        </div>
        <div className="compose-note muted">
          “Send” delivers via Gmail after a brief undo window (cancel from the Outbox in time and it
          never leaves). “Save draft” creates a reviewable Gmail draft you send yourself.
        </div>
      </div>
    </div>
  );
}
