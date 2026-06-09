# ⚡ SuperMail

A keyboard-first, Superhuman-style Gmail productivity client that runs locally.
Built with **Vite + React + TypeScript**. Ships with a **mock mailbox** so it's
usable immediately — no Gmail credentials required for development.

> Inspired by public Superhuman feature research (split inbox, command palette,
> inbox-zero triage, snooze/reminders, snippets, AI assist). No proprietary
> assets or branding are used.

## Features

- **Split Inbox** — default lanes (Important / Other / News / Social) plus an
  enableable **library** (VIP, Team, Calendar, Unread, Pinned, Receipts…), each a
  rule-driven predicate with per-split unread counts and number-key jumps.
- **Keyboard-first** — data-driven shortcut registry with a real **g-chord engine**
  (`g i` → Inbox, `g r` → Reminders, `g o` → Outbox…), single-key triage, and a
  searchable in-app reference (`?`).
- **Command palette** (`⌘K`) — fuzzy search over every action, with shortcut hints,
  grouping, and recents.
- **Focus view** (`⚡`, `g f`) — a priority-ranked "what needs your attention" queue:
  a deterministic per-conversation score (unread, ball-in-your-court, **VIP** sender,
  direct ask, pinned/starred, recency; newsletters penalized), each row tagged with
  *why*. Pin anyone as a **VIP** (★/☆) from the reader's sender card or a People
  profile to control the ranking.
- **Today (unified agenda)** (`🗓`, `g t`) — one timeline that merges calendar
  events, reminders/follow-ups, returning snoozed mail and scheduled sends, with a
  leading **Overdue** bucket then Today / Tomorrow / date; click any row to jump to
  the thread, Calendar or Outbox.
- **Conversation reader** — one row per thread, collapsible message history with
  **Expand / Collapse all** (`o`) and **in-thread `j`/`k` navigation** between
  messages, automatic **quoted-text trimming** ("show trimmed content"), a sender
  insight card, and private per-thread / per-person notes.
- **Reminders / follow-up** — "remind me" presets + a **remind-if-no-reply** safety
  net that only resurfaces when the other side hasn't replied; drafts a nudge for
  you, and each reminder can be **rescheduled** in place.
- **Send later + undo send** — scheduled sends and a configurable undo window flow
  through an **Outbox** where a queued send can be **rescheduled** or canceled
  (local simulation — see safety note).
- **Calendar & scheduling** — see upcoming events in-app (`g c`), **Find a time**
  across a window that honors working hours / skips weekends / avoids existing
  meetings, then **Insert availability** (a paste-ready "here are some times" block)
  into a draft or **Hold** a slot. Real calendar *writes* are intentionally disabled
  (mock only); availability is computed and labeled in UTC.
- **AI assist** — summarize, instant replies, **write-with-AI**, **ask-your-inbox**
  Q&A with clickable sources, **auto-labels**, and **auto-archive** suggestions — all
  with deterministic on-device fallbacks, wired behind optional provider env vars.
- **Labels** — nested Gmail-style label sidebar with counts; label via `L` or palette.
- **Compose** — cc/bcc, contact autocomplete, snippets (`;intro`), write-with-AI,
  send-later, **Send & Archive** (`⌘⇧↵` — reply and move on), and **save-as-draft**
  (the only path that touches a real account).
- **Undo / redo** (`⌘Z` / `⌘⇧Z`), onboarding tour, dense work-focused UI,
  empty/loading states.
- **Mock mailbox mode** with realistic seeded threads — no credentials needed.
- **Measurably fast** — virtualized conversation list, memoized rows, deferred
  search, debounced persistence and a quantized UI clock keep every keystroke
  far under Superhuman's own 100ms bar; a built-in latency HUD and a 10k-email
  pipeline benchmark (Stats → ⚡ Speed) prove it on your machine. See
  [Performance](#-performance-measured).

## ⚡ Performance (measured)

Superhuman's promise is "every interaction under 100ms". SuperMail ships the
instrumentation to *verify* that promise live, and beats it by an order of
magnitude on a stock laptop container (headless Chromium, production build):

| Metric | Measured | Notes |
| --- | --- | --- |
| Keyboard action → painted frame (p50) | **~10–17ms** | every triage keystroke is timed live (Stats → ⚡ Speed) |
| Keyboard action → painted frame (p95) | **~32–41ms** | 3× under the 100ms bar |
| 10,000-email pipeline (group → search → rank) | **~50ms** | one-click in-app benchmark, deterministic mailbox |
| 6,000-thread mailbox: cold load → first rows | **~500ms** | includes parsing a 2.7MB persisted blob |
| DOM rows for a 6,000-thread list | **~30** | windowed rendering; scrolling cost is O(viewport), not O(mailbox) |
| Jump to row 6,000 (scroll to bottom) | **instant** | fixed-height virtualization, exact math |

How it stays fast (`src/lib/perf.ts`, `src/lib/virtualList.ts`, App wiring):

- **Quantized UI clock** — derived data used to be invalidated by a fresh
  `Date.now()` on every render; the clock is now state on a 30s tick, so the
  filter → search → thread-group → rank pipeline stays memoized between ticks.
- **Virtualized list + memoized rows** — only the viewport (±overscan) touches
  the DOM; a `j`/`k` move repaints exactly two rows. Smart time labels
  ("9:41 AM" / "Yesterday" / "Jun 5") come from cached `Intl` formatters.
- **Deferred search** — typing renders at input speed; the operator pipeline
  follows via `useDeferredValue`.
- **Debounced persistence** — the mailbox is serialized once per burst of
  actions (with a `pagehide` flush), not once per keystroke.
- **Code-split surfaces** — Settings, Calendar, People, Today, the shortcut
  guide and Ask AI load on demand; the critical inbox bundle stays lean.
- **No theme flash** — the persisted theme is re-applied by an inline script
  *before first paint*.

Run it yourself: **Stats → ⚡ Speed → Run 10k benchmark** (or watch the live
keystroke percentiles fill in as you triage). The keyboard scroll-follow,
windowing math, latency stats and benchmark generator are all unit-tested.

## ⚡ Live Gmail sync (real-time)

SuperMail mirrors your real Gmail **the instant mail arrives** — no polling, no
refresh button. A tiny local **bridge** (`server/`) keeps one IMAP connection
open with **IDLE** (Gmail pushes new mail to it) and streams updates to the UI
over Server-Sent Events:

```
Gmail  ──IMAP IDLE──▶  bridge (localhost)  ──SSE──▶  SuperMail (browser)
```

It's **two-way**: incoming mail streams in real time, and your triage in SuperMail
(read/unread, star, archive, trash) is written back to Gmail over IMAP. Sending
goes out via Gmail SMTP — but only when *you* press Send and the undo window
elapses (the agent can never auto-send; the Gmail REST send API stays blocked —
see Safety). Local-only triage Gmail has no concept of (snooze, reminders, pins,
manual splits) is preserved across every sync. Opening a message renders the
**real HTML** (sanitized + shown in a sandboxed, script-less iframe), with inline
images and **downloadable attachments** — loaded on demand so the live mirror
stays light. The default look is a clean, light **Superhuman** theme (switch any
time in Settings → Appearance; a Superhuman Dark variant is included).

### Setup (~2 minutes)

1. **Enable 2-Step Verification** on the account → <https://myaccount.google.com/security>
2. **Create an App Password** (choose "Mail") → <https://myaccount.google.com/apppasswords>
   — Google shows 16 letters in 4 groups.
3. Put it in **`.env.local`** (copy from `.env.example`; this file is git-ignored
   and the password is **never** exposed to the browser):
   ```ini
   GMAIL_USER=federico.donatone@growthcab.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   ```
4. Run the UI and the bridge together:
   ```bash
   npm install        # first time only
   npm run live       # starts Vite + the sync bridge
   ```
   Open <http://localhost:5273> — the topbar shows a green **⚡ Live** pill and a
   new email in Gmail appears here within a second.

> App Passwords need IMAP enabled (Gmail → Settings → *Forwarding and POP/IMAP*).
> On Google Workspace, the admin must allow IMAP + App Passwords. If your domain
> blocks them, use the built-in OAuth path in **Settings → Gmail / Google OAuth**.

### Before the bridge is set up

The app loads a **captured snapshot** of your real inbox
(`public/live-snapshot.json`, git-ignored) so you see real mail immediately — the
topbar shows an amber **◐ Snapshot** pill. With nothing configured it falls back
to the bundled mock mailbox.

| Command | What it does |
| --- | --- |
| `npm run live` | UI + real-time bridge together (recommended) |
| `npm run sync` | Just the bridge (UI already running via `npm run dev`) |
| `npm run dev` | Just the UI (snapshot / mock data) |
| `npm run snapshot` | Rebuild the static real-mail snapshot |

### Always-on (survives restarts)

To keep syncing without a terminal open, the bridge also serves the **built UI
itself** — one process at `http://localhost:8787` — and can run as a macOS
LaunchAgent that auto-starts on login and relaunches on crash:

```bash
npm run build                                            # build the UI into dist/
launchctl load ~/Library/LaunchAgents/com.supermail.bridge.plist
```

Then open <http://localhost:8787> anytime — no `npm run …` needed. Re-run
`npm run build` after UI changes, then
`launchctl kickstart -k gui/$(id -u)/com.supermail.bridge` to restart.

## 🔒 Safety: sending is human-only; the agent never auto-sends

SuperMail can read, search, label, archive, trash, **create drafts**, and **send**
— but every send is **triggered by you** and gated; no automated/agent path can
send on its own:

- **Send = human + undo window.** Mail leaves only after you press **Send** in
  Compose *and* the undo-send window elapses (cancel from the Outbox in time and
  it never goes out). Delivery uses your account's Gmail **SMTP** (App Password)
  via the local bridge's `POST /api/send`, reached from exactly one place in the
  UI (the outbox tick) — never from AI/automation.
- **The Gmail REST send API stays permanently blocked.** `sendMessageRequest` and
  `GmailProvider.send` **throw** (`src/lib/safety.ts`); `assertNotSend` refuses
  `users.messages.send` / `users.drafts.send`; `gmail.send` is stripped from OAuth
  scopes — all proven by `src/lib/safety.test.ts`.
- **Credentials stay local.** The App Password lives in git-ignored `.env.local`,
  read only by the Node bridge, never exposed to the browser bundle.

Prefer review-first? **Save draft** still creates a Gmail draft you send yourself.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Command palette |
| `J` / `↓`, `K` / `↑` | Move selection (or messages within an open thread) |
| `Enter` | Open message |
| `E` | Archive |
| `H` | Snooze (tomorrow) |
| `S` | Star / unstar |
| `R` | Reply |
| `C` | Compose |
| `1`–`4` | Switch split inbox tab |
| `g t` | Go to Today (unified agenda) |
| `g c` | Go to Calendar |
| `/` | Focus search |
| `?` | Shortcuts guide |
| `Esc` | Close pane / modal |

## Setup & run

Requires Node 18+.

```bash
cd supermail
npm install
npm run dev      # http://localhost:5273  (mock mailbox — no credentials needed)
```

Other commands:

```bash
npm run build    # type-check (tsc --noEmit) + production build to dist/
npm run preview  # serve the production build
npm test         # run unit tests (vitest)
npm run lint     # type-check only
```

## Mock mode (default)

With no `.env.local`, `VITE_MAILBOX_MODE` defaults to `mock`. The app loads
seeded threads from `src/data/mockMailbox.ts` and all triage/compose actions
work in-memory. This is the recommended way to develop and demo.

## Gmail integration (optional)

The OAuth 2.0 + Gmail REST architecture is wired in `src/lib/gmail.ts` and the
Settings screen can authorize a live Gmail session. To enable real Gmail instead
of mock mode:

1. Create a **Web application** OAuth client in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
   Enable the **Gmail API**.
2. Add `http://localhost:5273` as an authorized JavaScript origin and
   `http://localhost:5273/oauth2/callback` as an authorized redirect URI.
3. Copy `.env.example` to `.env.local` and fill in, or paste the client ID in
   **Settings → Gmail / Google OAuth**:

   ```ini
   VITE_MAILBOX_MODE=gmail
   VITE_GOOGLE_CLIENT_ID=your-client-id
   VITE_GOOGLE_REDIRECT_URI=http://localhost:5273/oauth2/callback
   VITE_GOOGLE_OAUTH_FLOW=token
   VITE_GOOGLE_SCOPES=https://www.googleapis.com/auth/gmail.modify
   VITE_GMAIL_TARGET_ACCOUNT=federico.donatone@growthcab.com
   ```

4. Restart the dev server. **Settings** will show "Ready to authorize" with a
   *Connect* button. The callback verifies that the authorized account is
   `federico.donatone@growthcab.com`, then loads Gmail into the Growthcab scope.

When connected, SuperMail paginates live Gmail results, imports Gmail labels,
maps label IDs to readable names, preserves local triage state across refreshes
(snoozes, reminders, split overrides and read-receipt placeholders), and keeps
refreshed access tokens in browser `sessionStorage` for the current tab session.
From the Search view, **Search Gmail** runs the current SuperMail query against
Gmail's server-side search when an equivalent Gmail operator exists, then merges
the live results back into the local working set.

SuperMail never requests `gmail.send`; any accidental send scope is stripped at
load time, and Gmail send endpoints are blocked in code.

> Security note: access tokens live in browser `sessionStorage` for the current
> tab session. Do not put OAuth client secrets in frontend env vars; use a
> backend if your OAuth client requires a secret.

## AI assist (optional)

Drafting, summarization, and instant replies run as deterministic local
placeholders by default. To route to a real provider, set in `.env.local`:

```ini
VITE_AI_PROVIDER=anthropic        # or openai
VITE_AI_API_KEY=sk-...
VITE_AI_MODEL=claude-opus-4-8
```

See `src/lib/ai.ts` for the `aiComplete` integration point.

## Project structure

```
supermail/
  src/
    App.tsx                 # orchestrator: state, keyboard, layout
    types.ts
    data/                   # mock mailbox + default snippets
    lib/                    # mailbox logic (tested), gmail OAuth, ai assist
    components/             # CommandPalette, Compose, Settings, ShortcutsGuide
  vite.config.ts
```

## Tests

`npm test` runs vitest against the pure mailbox logic in `src/lib/mailbox.ts`
(split categorization, snooze expiry, view filtering, search, unread counts).
