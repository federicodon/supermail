import { useState } from "react";
import type { GmailConfig } from "../lib/gmail";
import { GMAIL_ENDPOINTS, isGmailConfigured } from "../lib/gmail";
import type { AiConfig } from "../lib/ai";
import { newCustomSplit } from "../lib/splitInbox";
import { SNIPPET_VARIABLES } from "../lib/snippets";
import type { AppSettings } from "../lib/persistence";
import type { Account } from "../lib/accounts";
import type { Keymap } from "../lib/keymap";
import { KeyboardSettings } from "./KeyboardSettings";
import { ACCENTS, getTheme, themeVars, themesByGroup } from "../lib/theme";
import {
  describeVoice,
  removeFact,
  type GreetingStyle,
  type Personalization,
  type Tone,
  type Verbosity,
} from "../lib/personalization";
import type { BlockEntry, Label, Snippet, SplitInbox, SplitRule, SplitRuleField, SplitRuleOp } from "../types";

const RULE_FIELDS: SplitRuleField[] = [
  "from", "fromDomain", "to", "subject", "body", "label", "category", "hasAttachment", "isUnread", "isStarred",
];
const RULE_OPS: SplitRuleOp[] = ["contains", "equals", "is"];

export function Settings({
  gmail,
  gmailStatus,
  onGmailClientIdChange,
  onConnectGmail,
  onDisconnectGmail,
  onReloadGmail,
  ai,
  settings,
  onSettings,
  accounts,
  onAccountsChange,
  labels,
  labelCountFor,
  onCreateLabel,
  onRenameLabel,
  onRecolorLabel,
  onDeleteLabel,
  splits,
  onSplitsChange,
  snippets,
  onSnippetsChange,
  blocks,
  onUnblock,
  vipOverrides,
  onClearVip,
  personalization,
  onPersonalize,
  onPersonalizationChange,
  keymap,
  onKeymapChange,
  onExportData,
  onImportData,
  onReset,
}: {
  gmail: GmailConfig;
  gmailStatus: {
    busy: boolean;
    connectedEmail: string;
    targetEmail: string;
    notice: string | null;
    live: boolean;
  };
  onGmailClientIdChange: (clientId: string) => void;
  onConnectGmail: () => void;
  onDisconnectGmail: () => void;
  onReloadGmail: () => void;
  ai: AiConfig;
  settings: AppSettings;
  onSettings: (patch: Partial<AppSettings>) => void;
  accounts: Account[];
  onAccountsChange: (next: Account[]) => void;
  labels: Label[];
  labelCountFor: (name: string) => number;
  onCreateLabel: (name: string) => void;
  onRenameLabel: (id: string, name: string) => void;
  onRecolorLabel: (id: string, color: string) => void;
  onDeleteLabel: (id: string) => void;
  splits: SplitInbox[];
  onSplitsChange: (next: SplitInbox[]) => void;
  snippets: Snippet[];
  onSnippetsChange: (next: Snippet[]) => void;
  blocks: BlockEntry[];
  onUnblock: (value: string) => void;
  vipOverrides: { email: string; name: string; vip: boolean }[];
  onClearVip: (email: string) => void;
  personalization: Personalization;
  onPersonalize: (feedback: string) => void;
  onPersonalizationChange: (next: Personalization) => void;
  keymap: Keymap;
  onKeymapChange: (next: Keymap) => void;
  onExportData: () => void;
  onImportData: (json: string, mode: "replace" | "merge") => void;
  onReset: () => void;
}) {
  const [teach, setTeach] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const submitNewLabel = () => {
    const t = newLabel.trim();
    if (!t) return;
    onCreateLabel(t);
    setNewLabel("");
  };
  const submitTeach = () => {
    const t = teach.trim();
    if (!t) return;
    onPersonalize(t);
    setTeach("");
  };
  const setVoice = (patch: Partial<Personalization>) =>
    onPersonalizationChange({ ...personalization, ...patch });
  const configured = isGmailConfigured(gmail);

  // ---- Split editing helpers ----
  const updateSplit = (id: string, patch: Partial<SplitInbox>) =>
    onSplitsChange(splits.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const updateRule = (id: string, idx: number, patch: Partial<SplitRule>) =>
    updateSplit(id, {
      rules: splits.find((s) => s.id === id)!.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    });
  const addRule = (id: string) =>
    updateSplit(id, {
      rules: [...splits.find((s) => s.id === id)!.rules, { field: "from", op: "contains", value: "" }],
    });
  const removeRule = (id: string, idx: number) =>
    updateSplit(id, { rules: splits.find((s) => s.id === id)!.rules.filter((_, i) => i !== idx) });
  const addSplit = () => onSplitsChange([...splits, newCustomSplit("New split")]);
  const deleteSplit = (id: string) => onSplitsChange(splits.filter((s) => s.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const i = splits.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= splits.length) return;
    const next = splits.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onSplitsChange(next);
  };

  // ---- Per-account signature editing ----
  const setAccountSignature = (id: string, signature: string) =>
    onAccountsChange(accounts.map((a) => (a.id === id ? { ...a, signature } : a)));

  // ---- Snippet editing helpers ----
  const updateSnippet = (id: string, patch: Partial<Snippet>) =>
    onSnippetsChange(snippets.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const addSnippet = () =>
    onSnippetsChange([
      ...snippets,
      { id: `s${Date.now()}`, name: "New snippet", shortcut: ";new", body: "" },
    ]);
  const deleteSnippet = (id: string) => onSnippetsChange(snippets.filter((s) => s.id !== id));

  return (
    <div className="settings">
      <h2>Settings</h2>

      {/* ---- Account & identity ---- */}
      <section className="card">
        <h3>Account &amp; identity</h3>
        <div className="form-grid">
          <label>
            <span>Your name</span>
            <input value={settings.selfName} onChange={(e) => onSettings({ selfName: e.target.value })} />
          </label>
          <label>
            <span>Your email</span>
            <input value={settings.selfEmail} onChange={(e) => onSettings({ selfEmail: e.target.value })} />
          </label>
        </div>
        <label className="field-block">
          <span>{accounts.length > 1 ? "Default signature" : "Signature"}</span>
          <textarea
            rows={3}
            value={settings.signature}
            onChange={(e) => onSettings({ signature: e.target.value })}
          />
          <span className="hint muted">
            Auto-inserted into new messages, replies and forwards (above the quoted text). Leave
            blank for none. AI-written drafts use your learned voice sign-off instead.
            {accounts.length > 1 && " Used for any account without its own signature below."}
          </span>
        </label>

        {accounts.length > 1 && (
          <div className="field-block">
            <span>Per-account signatures</span>
            <span className="hint muted">
              Each connected account can sign with its own block — Compose picks it from the “From”
              account. Clear a box to fall back to the default signature above.
            </span>
            <div className="acct-sig-list">
              {accounts.map((a) => (
                <label key={a.id} className="acct-sig">
                  <span className="acct-sig-head">
                    <span className="acct-av" style={{ background: a.color }}>
                      {(a.name || a.email).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="acct-sig-name">
                      {a.name} <span className="muted">· {a.email}</span>
                    </span>
                  </span>
                  <textarea
                    rows={2}
                    placeholder="(uses the default signature)"
                    value={a.signature ?? ""}
                    onChange={(e) => setAccountSignature(a.id, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ---- Appearance (themes / accent / density) ---- */}
      <section className="card">
        <h3>Appearance</h3>
        <span className="hint muted">Pick a theme — the whole app recolors instantly. Cycle anytime from the command palette.</span>
        {(["dark", "light"] as const).map((group) => (
          <div key={group} className="theme-group">
            <div className="theme-group-title">{group === "dark" ? "Dark" : "Light"}</div>
            <div className="theme-grid">
              {themesByGroup()[group].map((t) => {
                const v = themeVars(t.id, settings.accent);
                return (
                  <button
                    key={t.id}
                    className={`theme-swatch ${settings.theme === t.id ? "active" : ""}`}
                    onClick={() => onSettings({ theme: t.id })}
                    title={t.name}
                    style={{ background: v["--panel"], borderColor: settings.theme === t.id ? v["--accent"] : v["--line"] }}
                  >
                    <span className="theme-preview" style={{ background: v["--bg"] }}>
                      <span className="dot" style={{ background: v["--accent"] }} />
                      <span className="dot" style={{ background: v["--accent-2"] }} />
                      <span className="bar" style={{ background: v["--text"] }} />
                      <span className="bar short" style={{ background: v["--muted"] }} />
                    </span>
                    <span className="theme-name" style={{ color: v["--text"] }}>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="field-block">
          <span>Accent color</span>
          <div className="accent-row">
            {ACCENTS.map((a) => {
              const swatch = a.value || getTheme(settings.theme).vars["--accent"];
              return (
                <button
                  key={a.id}
                  className={`accent-dot ${settings.accent === a.id ? "active" : ""}`}
                  title={a.name}
                  onClick={() => onSettings({ accent: a.id })}
                  style={{ background: swatch }}
                >
                  {a.id === "" ? "A" : ""}
                </button>
              );
            })}
          </div>
        </div>
        <label className="field-block">
          <span>Density</span>
          <select value={settings.density} onChange={(e) => onSettings({ density: e.target.value as AppSettings["density"] })}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
      </section>

      {/* ---- Reading & triage ---- */}
      <section className="card">
        <h3>Reading &amp; triage</h3>
        <div className="form-grid">
          <label>
            <span>Undo-send window (seconds)</span>
            <input
              type="number"
              min={0}
              max={60}
              value={Math.round(settings.undoWindowMs / 1000)}
              onChange={(e) => onSettings({ undoWindowMs: Math.max(0, Number(e.target.value)) * 1000 })}
            />
          </label>
        </div>
        <div className="toggle-row">
          <label className="toggle">
            <input type="checkbox" checked={settings.autoAdvance} onChange={(e) => onSettings({ autoAdvance: e.target.checked })} />
            <span>Auto-advance to the next conversation after triage</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.readReceipts} onChange={(e) => onSettings({ readReceipts: e.target.checked })} />
            <span>Show read-status placeholders on sent mail</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.confirmArchiveAll} onChange={(e) => onSettings({ confirmArchiveAll: e.target.checked })} />
            <span>Confirm before bulk / “archive all” actions</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.sendAndArchive} onChange={(e) => onSettings({ sendAndArchive: e.target.checked })} />
            <span>After sending a reply, archive the conversation (reply &amp; move on)</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={settings.autoFollowUp} onChange={(e) => onSettings({ autoFollowUp: e.target.checked })} />
            <span>Remind me if no reply on every reply by default (auto follow-up, ~3 days)</span>
          </label>
        </div>
      </section>

      {/* ---- Keyboard shortcuts (rebinding) ---- */}
      <KeyboardSettings keymap={keymap} onChange={onKeymapChange} />

      {/* ---- Split Inbox editor ---- */}
      <section className="card">
        <h3>Split Inbox</h3>
        <p className="muted">
          Enable focused lanes; number keys 1–9 jump between active splits. Each split is a set of
          rules (sender, domain, subject, label, category, attachment, unread, starred).
        </p>
        <ul className="split-editor">
          {splits.map((s, i) => (
            <li key={s.id} className="split-edit">
              <div className="split-edit-head">
                <label className="toggle">
                  <input type="checkbox" checked={s.enabled} onChange={() => updateSplit(s.id, { enabled: !s.enabled })} />
                  <input
                    className="split-name-input"
                    value={s.name}
                    onChange={(e) => updateSplit(s.id, { name: e.target.value })}
                  />
                </label>
                <select value={s.match} onChange={(e) => updateSplit(s.id, { match: e.target.value as "all" | "any" })}>
                  <option value="all">match all</option>
                  <option value="any">match any</option>
                </select>
                <div className="split-edit-actions">
                  <button title="Move up" onClick={() => move(s.id, -1)} disabled={i === 0}>↑</button>
                  <button title="Move down" onClick={() => move(s.id, 1)} disabled={i === splits.length - 1}>↓</button>
                  <button className={s.pinned ? "on" : ""} title="Pin" onClick={() => updateSplit(s.id, { pinned: !s.pinned })}>📌</button>
                  {!s.builtin && <button title="Delete" onClick={() => deleteSplit(s.id)}>🗑</button>}
                </div>
              </div>
              <div className="rule-rows">
                {s.rules.map((r, idx) => (
                  <div key={idx} className="rule-row">
                    <select value={r.field} onChange={(e) => updateRule(s.id, idx, { field: e.target.value as SplitRuleField })}>
                      {RULE_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <select value={r.op} onChange={(e) => updateRule(s.id, idx, { op: e.target.value as SplitRuleOp })}>
                      {RULE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <input
                      value={r.value}
                      placeholder="value"
                      onChange={(e) => updateRule(s.id, idx, { value: e.target.value })}
                    />
                    <button onClick={() => removeRule(s.id, idx)}>✕</button>
                  </div>
                ))}
                <button className="link" onClick={() => addRule(s.id)}>+ Add rule</button>
              </div>
            </li>
          ))}
        </ul>
        <button className="add-btn" onClick={addSplit}>+ New custom split</button>
      </section>

      {/* ---- Labels manager ---- */}
      <section className="card">
        <h3>Labels</h3>
        <p className="muted">
          Create, rename, recolor or delete labels. Use “/” to nest (e.g.{" "}
          <code>Clients/Acme</code>) — the sidebar renders the tree. Renaming or deleting updates
          every message that carries the label. You can also create a label on the fly while
          labeling a conversation (the <code>l</code> menu).
        </p>
        <ul className="label-editor">
          {labels.map((l) => (
            <li key={l.id} className="label-edit">
              <input
                type="color"
                className="label-color"
                value={l.color ?? "#64748b"}
                title="Label color"
                onChange={(e) => onRecolorLabel(l.id, e.target.value)}
              />
              <input
                className="label-name-input"
                value={l.name}
                onChange={(e) => onRenameLabel(l.id, e.target.value)}
              />
              <span className="label-count muted">{labelCountFor(l.name)}</span>
              <button title="Delete label" onClick={() => onDeleteLabel(l.id)}>🗑</button>
            </li>
          ))}
        </ul>
        <div className="label-create">
          <input
            placeholder="New label name… (e.g. Investors or Clients/Acme)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNewLabel();
              }
            }}
          />
          <button onClick={submitNewLabel} disabled={!newLabel.trim()}>+ Create label</button>
        </div>
      </section>

      {/* ---- Snippets manager ---- */}
      <section className="card">
        <h3>Snippets</h3>
        <p className="muted">
          Type a shortcut (e.g. <code>;intro</code>) in compose to expand it. Variables fill from the
          message context:
        </p>
        <div className="snippet-vars">
          {SNIPPET_VARIABLES.map((v) => (
            <span key={v.token} className="snippet-var" title={v.desc}><code>{v.token}</code></span>
          ))}
        </div>
        <ul className="snippet-editor">
          {snippets.map((s) => (
            <li key={s.id} className="snippet-edit">
              <div className="snippet-edit-head">
                <input className="snippet-name" value={s.name} onChange={(e) => updateSnippet(s.id, { name: e.target.value })} placeholder="Name" />
                <input className="snippet-short" value={s.shortcut} onChange={(e) => updateSnippet(s.id, { shortcut: e.target.value })} placeholder=";shortcut" />
                <button onClick={() => deleteSnippet(s.id)}>🗑</button>
              </div>
              <textarea rows={2} value={s.body} onChange={(e) => updateSnippet(s.id, { body: e.target.value })} placeholder="Body" />
            </li>
          ))}
        </ul>
        <button className="add-btn" onClick={addSnippet}>+ New snippet</button>
      </section>

      {/* ---- Blocked & unsubscribed ---- */}
      <section className="card">
        <h3>Blocked &amp; unsubscribed senders</h3>
        <p className="muted">
          When you unsubscribe or mark spam, SuperMail adds the sender (or domain) here so future
          mail auto-archives. This is <strong>local only</strong> — SuperMail never emails the sender
          or reports them to any provider. Remove an entry to let their mail back into the inbox.
        </p>
        {blocks.length === 0 ? (
          <p className="muted"><em>No blocked senders yet.</em></p>
        ) : (
          <ul className="block-list">
            {blocks.map((b) => (
              <li key={b.value} className="block-item">
                <span className={`pill ${b.reason}`}>{b.reason}</span>
                <code>{b.value}</code>
                <span className="muted">{b.scope}</span>
                <button className="link" onClick={() => onUnblock(b.value)}>Unblock</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3>VIP contacts</h3>
        <p className="muted">
          VIPs are highlighted and boosted in <strong>Focus</strong>. SuperMail auto-detects your
          frequent and starred correspondents; you can pin or demote anyone from a sender card or the
          People view. Those manual choices win over the automatic guess and are listed here — reset
          one to fall back to the heuristic. Local only.
        </p>
        {vipOverrides.length === 0 ? (
          <p className="muted"><em>No manual VIP overrides — Focus is using the automatic guess.</em></p>
        ) : (
          <ul className="block-list">
            {vipOverrides.map((v) => (
              <li key={v.email} className="block-item">
                <span className={`pill ${v.vip ? "vip-on" : "vip-off"}`}>{v.vip ? "★ VIP" : "Not VIP"}</span>
                <code>{v.name}</code>
                <span className="muted">{v.email}</span>
                <button className="link" onClick={() => onClearVip(v.email)}>Reset to auto</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3>Gmail / Google OAuth</h3>
        <p className="muted">
          Connects only the authorized Growthcab mailbox. The browser token flow stores tokens for
          this tab session and SuperMail blocks every Gmail send endpoint.
        </p>
        <label className="field-block">
          <span>Google OAuth Client ID</span>
          <input
            value={gmail.clientId}
            onChange={(e) => onGmailClientIdChange(e.target.value)}
            placeholder="1234567890-abc.apps.googleusercontent.com"
            spellCheck={false}
          />
          <span className="hint muted">
            Create this in Google Cloud as a Web application with redirect URI{" "}
            <code>{gmail.redirectUri}</code>. This is not a secret.
          </span>
        </label>
        <dl className="kv">
          <dt>Mode</dt>
          <dd>{gmail.enabled ? "gmail" : "mock"}</dd>
          <dt>Target account</dt>
          <dd>{gmailStatus.targetEmail}</dd>
          <dt>Connected account</dt>
          <dd>{gmailStatus.connectedEmail || <em>not connected</em>}</dd>
          <dt>Redirect URI</dt>
          <dd>{gmail.redirectUri}</dd>
          <dt>OAuth flow</dt>
          <dd>{gmail.oauthFlow}</dd>
          <dt>Scopes</dt>
          <dd>{gmail.scopes.join(", ")}</dd>
        </dl>
        <div className={`status ${gmailStatus.live ? "ok" : configured ? "warn" : "warn"}`}>
          {gmailStatus.live
            ? `Live Gmail connected as ${gmailStatus.connectedEmail}`
            : configured
            ? "Ready to authorize"
            : "Paste a Client ID to authorize Gmail"}
        </div>
        {gmailStatus.notice && (
          <p className="read-status">{gmailStatus.notice}</p>
        )}
        <div className="oauth-actions">
          <button className="auth-btn" onClick={onConnectGmail} disabled={!configured || gmailStatus.busy}>
            {gmailStatus.busy ? "Working..." : `Connect ${gmailStatus.targetEmail}`}
          </button>
          <button onClick={onReloadGmail} disabled={!gmailStatus.live || gmailStatus.busy}>
            Reload Gmail
          </button>
          <button onClick={onDisconnectGmail} disabled={!gmailStatus.connectedEmail || gmailStatus.busy}>
            Disconnect
          </button>
        </div>
        <details>
          <summary>Gmail REST surface</summary>
          <ul className="endpoints">
            {Object.entries(GMAIL_ENDPOINTS).map(([k, v]) => (
              <li key={k} className={String(v).startsWith("DISABLED") ? "disabled-endpoint" : ""}>
                <strong>{k}</strong>: <code>{v}</code>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="card safety-card">
        <h3>🔒 Safety: sending is disabled</h3>
        <p>
          SuperMail can read, search, label, archive and create <strong>drafts</strong>, but it{" "}
          <strong>never sends email</strong>. The Gmail endpoints <code>users.messages.send</code> and{" "}
          <code>users.drafts.send</code> are blocked in code and proven disabled by unit tests
          (<code>safety.test.ts</code>). Generated drafts are always left for you to review and send
          manually from Gmail.
        </p>
      </section>

      {/* ---- AI personalization (learns your voice) ---- */}
      <section className="card">
        <h3>Your voice (AI personalization)</h3>
        <p className="muted">
          SuperMail writes replies, follow-ups and “write with AI” in your voice. Teach it in plain
          English, or tune the controls. Active voice: <code>{describeVoice(personalization)}</code>
        </p>
        <div className="teach-row">
          <input
            placeholder='e.g. “Use casual greetings like Hey”, “sign off with Cheers”, “my title is VP”'
            value={teach}
            onChange={(e) => setTeach(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitTeach()}
          />
          <button onClick={submitTeach}>Teach</button>
        </div>
        <div className="form-grid">
          <label>
            <span>Greeting</span>
            <select value={personalization.greetingStyle} onChange={(e) => setVoice({ greetingStyle: e.target.value as GreetingStyle })}>
              <option value="neutral">Hi …</option>
              <option value="casual">Hey …</option>
              <option value="formal">Dear …</option>
              <option value="none">No greeting</option>
            </select>
          </label>
          <label>
            <span>Tone</span>
            <select value={personalization.tone} onChange={(e) => setVoice({ tone: e.target.value as Tone })}>
              <option value="casual">Casual</option>
              <option value="neutral">Neutral</option>
              <option value="formal">Formal</option>
            </select>
          </label>
          <label>
            <span>Length</span>
            <select value={personalization.verbosity} onChange={(e) => setVoice({ verbosity: e.target.value as Verbosity })}>
              <option value="brief">Brief</option>
              <option value="balanced">Balanced</option>
              <option value="detailed">Detailed</option>
            </select>
          </label>
          <label>
            <span>Sign-off</span>
            <input value={personalization.signOff} onChange={(e) => setVoice({ signOff: e.target.value })} />
          </label>
          <label>
            <span>Signed name</span>
            <input value={personalization.name} onChange={(e) => setVoice({ name: e.target.value })} />
          </label>
        </div>
        {personalization.facts.length > 0 && (
          <>
            <p className="muted">Facts SuperMail remembers about you:</p>
            <ul className="block-list">
              {personalization.facts.map((fact) => (
                <li key={fact} className="block-item">
                  <code>{fact}</code>
                  <button className="link" onClick={() => onPersonalizationChange(removeFact(personalization, fact))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="muted">
          Deterministic &amp; on-device — your voice settings never leave this browser.
        </p>
      </section>

      <section className="card">
        <h3>AI assist</h3>
        <dl className="kv">
          <dt>Provider</dt>
          <dd>{ai.provider || <em>local placeholder</em>}</dd>
          <dt>Model</dt>
          <dd>{ai.model}</dd>
          <dt>Status</dt>
          <dd>{ai.enabled ? "enabled" : "deterministic local fallback"}</dd>
        </dl>
        <p className="muted">
          Summaries, instant replies, write-with-AI, ask-inbox, auto-labels and auto-archive
          suggestions all run on-device with a deterministic fallback until a provider key is set via{" "}
          <code>VITE_AI_PROVIDER</code> and <code>VITE_AI_API_KEY</code>. No inbox data leaves your
          machine in local mode.
        </p>
      </section>

      <section className="card">
        <h3>Read statuses</h3>
        <p className="muted">
          Gmail's REST API does not expose message-open events, so read receipts on sent mail are a{" "}
          <strong>placeholder</strong> modelled in mock mode only. Real receipts would require a
          tracking pixel or a dedicated backend, which SuperMail intentionally does not ship.
        </p>
      </section>

      <section className="card">
        <h3>Backup &amp; restore</h3>
        <p className="muted">
          Export your entire local working set — mailbox triage, splits, snippets, labels, notes,
          reminders, settings — as a JSON file you can keep or move to another browser. The file
          contains <strong>no</strong> passwords, OAuth tokens or credentials (those are never
          persisted). <strong>Replace</strong> overwrites your current local data with the file;
          <strong> Merge</strong> combines them (the file wins on any conflict, but nothing you
          have here is lost). Both reload afterwards.
        </p>
        <div className="data-actions">
          <button onClick={onExportData}>⭳ Export data (JSON)</button>
          <label className="import-btn">
            ⭱ Import (replace)…
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => onImportData(String(reader.result || ""), "replace");
                reader.readAsText(f);
                e.target.value = ""; // allow re-importing the same file
              }}
            />
          </label>
          <label className="import-btn">
            ⭿ Merge backup…
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => onImportData(String(reader.result || ""), "merge");
                reader.readAsText(f);
                e.target.value = ""; // allow re-importing the same file
              }}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h3>Data &amp; privacy</h3>
        <ul className="privacy-notes">
          <li>Local-first: the mock mailbox, settings and all AI fallbacks run entirely in your browser.</li>
          <li>State is persisted only to this browser's localStorage; nothing is uploaded.</li>
          <li>OAuth tokens are held in memory only; no secrets are written to disk by the app.</li>
          <li>Sending is hard-disabled; the app can only ever create reviewable drafts.</li>
        </ul>
        <button className="danger-btn" onClick={onReset}>Reset mailbox &amp; clear local data</button>
      </section>
    </div>
  );
}
