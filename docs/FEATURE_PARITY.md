# SuperMail vs Superhuman — Feature Parity

SuperMail is a keyboard-first, local-first Gmail productivity client. The goal is to
**functionally** match and improve on the publicly documented Superhuman product
surface for a power Gmail user — without copying proprietary assets, brand, names, or
pixel-perfect copyrighted UI.

This document is the living checklist and shipped backlog. It is updated as slices ship.

Legend: ✅ shipped · 🟡 partial / in progress · ⬜ not started

## Public Superhuman references used as requirements

- Mail product overview — https://superhuman.com/products/mail
- AI product — https://superhuman.com/products/mail/ai
- Keyboard shortcuts (help + PDF) — https://help.superhuman.com/hc/en-us/articles/45191759067411-Speed-Up-With-Shortcuts and https://download.superhuman.com/Superhuman%20Keyboard%20Shortcuts.pdf
- Split Inbox basics — https://help.superhuman.com/hc/en-us/articles/38449611367187-Split-Inbox-Basics
- Default Split Inboxes — https://help.superhuman.com/hc/en-us/articles/38458392810643-Default-Split-Inboxes
- Labels (Gmail accounts) — https://help.superhuman.com/hc/en-us/articles/38458359354643-Labels-Gmail-Accounts
- Remind Me — https://help.superhuman.com/hc/en-us/articles/43822934607251-Remind-Me
- AI overview — https://help.superhuman.com/hc/en-us/articles/38456908110227-Superhuman-AI-Overview
- Compose Quickly — https://help.superhuman.com/hc/en-us/articles/45263736431507-Compose-Quickly

---

## 1. Speed & keyboard-first navigation

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Command palette (Cmd/Ctrl+K) fuzzy command run | Yes (Cmd+K) | Yes, fuzzy + scored + shortcut hints + recent | ✅ |
| Single-key triage (archive/snooze/star/reply) | Yes | Yes (e/h/s/r and more) | ✅ |
| `g`-chord navigation (g+i inbox, g+t starred…) | Yes | Yes, chord engine | ✅ |
| Move down/up (j/k + arrows) | Yes | Yes | ✅ |
| **Flip through conversations from the reader** | Yes (process without leaving the reader) | Yes — **Shift+J / Shift+K** jump to the next / previous conversation *and open it*, so you can fly through the inbox without bouncing back to the list; anchored on the thread you're reading (works mid-thread), clamped at the ends (no wrap). Distinct from j/k, which move the row cursor in the list and step between messages inside a thread. Palette commands + shortcuts guide | ✅ |
| Open / back (Enter / Esc / u) | Yes | Yes | ✅ |
| **Auto-advance to next conversation after triage** | Yes (core flow) | Yes — archive/delete/snooze/mute/spam from the reader jumps straight to the next thread (marks it read), settings toggle + palette command | ✅ |
| Mark read/unread, select, range select | Yes | Read/unread (`t`), mark-unread (`⇧U`), star, `x` select + shift-click range | ✅ |
| Delete to Trash / mark Spam by keyboard | Yes (`#` / `!`) | Yes — `#` Trash, `!` Spam, both undoable | ✅ |
| Mute / pin a conversation | Yes | Yes — `m` mute, `p` pin (floats to top) | ✅ |
| Bulk actions on a multi-selection | Yes | Yes — Archive · Delete · Mark read · **Mark unread** · Star · Snooze… · **Remind…** · Label… · Move…, plus select-all; each is one undoable step. Bulk **Remind** lands one reminder per conversation (on its latest message) so the Reminders view stays one-row-per-thread | ✅ |
| **Hover quick-actions on a conversation row** | Yes | Yes — a floating toolbar on row hover / the selected row (Archive · Snooze · Delete · Read-toggle · Pin), context-aware (Trash/Spam rows offer Restore / Not-spam / Delete-forever); routes to the same handlers as the keyboard, so mouse + keyboard never drift | ✅ |
| **One-move inbox sweep** (mark all read / archive all read) | Yes | Yes — view/split/search-aware, undoable, keeps pinned, split-row buttons + palette, confirm-gated | ✅ |
| Jump to split tabs (1–9) | Yes | Yes | ✅ |
| Keyboard shortcut reference (?) | Yes | Yes, grouped + searchable, reflects custom keys | ✅ |
| **Customize / remap shortcuts** | Yes | Yes — Settings "Keyboard shortcuts" card: click-to-record any rebindable action, conflict detection, unbind, per-row + global reset; chords & palette locked; persisted | ✅ |
| Shortcut training / onboarding | Yes | Onboarding tour + practice prompts + **Speed coach** inside the `?` shortcut guide: drills the highest-leverage actions, handles chords, scores accuracy/streak, and reflects remapped keys | ✅ |
| Undo last action (Cmd+Z / u) | Yes | Yes, action undo stack | ✅ |
| **Redo an undone action (Cmd+Shift+Z)** | — | Yes — a redo stack mirrors undo; redo re-applies the last undone triage, and any fresh action invalidates it (palette command + shortcut) | ✅ |
| Search with operators (from:/to:/cc:/is:/has:/label:/before:…) | Yes | Yes, parser + negation + quotes + Gmail `q` mapping; `is:` covers unread/read/starred/snoozed/sent/reminded/**pinned**/**muted**/**meeting** (a local virtual filter for scheduling requests) / **actionable** (`is:actionable` — any message asking something of you: a deadline, request or direct question, powered by the action-item detector) / **committed** (`is:committed` — a promise *you* made in your sent mail, powered by the commitment detector) / **newsletter** (`is:newsletter`, aliases `is:bulk` / `is:list` — bulk / mailing-list mail: anything with a `List-Unsubscribe` header, a news/social category, an automated sender or an "unsubscribe" footer, for sweeping newsletters in one query), plus Gmail-familiar **`newer_than:`/`older_than:`** relative-date aliases (`newer_than:7d`) alongside `before:`/`after:`; `has:` covers **attachment** and **`has:link`** (alias `has:url` — any message whose body carries a URL, for "find that email with the doc/Figma link"; conservative scheme/`www.`-only detection so a bare email address never counts) | ✅ |
| Saved searches / smart views (pinned in sidebar) | Yes | Yes — named queries, sidebar section, unread badges, save/delete, palette commands | ✅ |
| **Focus view — "what needs your attention"** | Yes (focus on what matters) | Yes — a priority-ranked attention queue (`⚡ Focus`, `g f`): a deterministic per-conversation score (unread, ball-in-your-court, VIP sender, **scheduling request**, direct ask, pinned/starred, recency; bulk/newsletter penalized) keeps only the threads that need you, ranked, each tagged with **why** (⚡ Unread / VIP sender / Scheduling request / Direct ask…); sidebar count badge | ✅ |
| **Today — unified daily agenda** | Partial (Reminders only) | Yes (improves on it) — `🗓 Today` (`g t`) merges calendar events, reminders/follow-ups, returning snoozed mail and scheduled sends onto one timeline; a leading **Overdue** bucket then Today / Tomorrow / date; per-item kind chips; click opens the thread / Calendar / Outbox; **per-row quick-actions** act without opening — ✓ Done clears a reminder, ⏪ Return now un-snoozes a conversation, ✕ Cancel kills a scheduled send (each routes to the same handler as the Reminders/Snoozed/Outbox views, single & undoable); sidebar count badge | ✅ |

## 2. Split Inbox

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Default split inboxes (Important/Other/News/Social…) | Yes | Yes | ✅ |
| Split inbox library (Team, VIP, Calendar, Pinned, Unread, Starred, News, Updates…) | Yes | Yes, library presets | ✅ |
| Custom split rules (sender/domain/label/subject/has-attachment/unread) | Yes | Yes, rule engine + AND/OR | ✅ |
| Per-split unread counts | Yes | Yes | ✅ |
| Reorder / enable / disable splits | Yes | Yes (settings + persistence) | ✅ |
| Pinned / focused split at top | Yes | Yes | ✅ |
| **Manually move a conversation to a split** | Yes | Yes — `v` / reader "Move" / palette opens a split picker; the manual assignment overrides the rules **exclusively** (the thread leaves every other lane), "↺ Auto" restores rule-based; undoable, persisted on the message. A **bulk "Move…"** in the multi-select bar reassigns every selected conversation to a lane (or back to Auto) in one undoable step | ✅ |

## 3. Labels & folders

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Gmail label navigation | Yes | Yes, label sidebar + counts | ✅ |
| Apply / remove labels via keyboard | Yes | Yes (l to label) | ✅ |
| **Create / rename / recolor / delete labels** | Yes | Yes — in-app label manager (Settings) + **create-on-the-fly** in the `l` menu (type a name → made & applied); rename/delete propagate across the mailbox; persisted | ✅ |
| Nested labels | Yes | Yes (parent/child display) | ✅ |
| Label as split source | Yes | Yes | ✅ |
| **Trash folder** | Yes | Yes — `#` to delete, dedicated Trash view, Restore / Delete-forever / Empty Trash, undoable | ✅ |
| **Spam folder** | Yes | Yes — `!` to mark, dedicated Spam view, "Not spam" to recover (local-only, never reports) | ✅ |
| **Mute conversation** | Yes | Yes — `m`; stays out of the inbox even on new replies, still searchable | ✅ |
| **Pin conversation** | Yes | Yes — `p`; pinned threads float to the top of the list | ✅ |

## 4. Remind Me / Follow-up

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Remind me on a thread (presets + custom) | Yes | Yes, smart presets (exact clock times) + natural-language typing | ✅ |
| Natural-language time ("next tue 9am", "in 3 days") | Yes | Yes — `parseNaturalTime` engine, live preview | ✅ |
| **Detect dates in a message** → one-click remind/snooze | Yes (AI) | Yes — `extractTimeMentions` scans the open conversation ("…Friday at 5pm…") and offers ⏰ Remind / 💤 Snooze exactly then; false-positive-guarded | ✅ |
| Remind if no reply (follow-up safety net) | Yes | Yes — fires only when no inbound reply has arrived **since you started waiting** (measured from when the reminder was set, `reminderSetAt`, not the fire time — so a reply landing *before* the follow-up is due correctly cancels it); arm it straight from the composer (see Compose) or on any thread; rescheduling resets the cutoff | ✅ |
| Resurface at the right time | Yes | Yes, deterministic resurfacing engine | ✅ |
| Reminders view | Yes | Yes — due / upcoming, with open, **reschedule** (smart presets + natural language + the if-no-reply toggle), clear, and draft-follow-up per row | ✅ |
| Auto follow-up draft suggestion | Yes (AI) | Yes (AI fallback) | ✅ |
| **Auto follow-up by default ("never drop the ball")** | Yes | Yes — a Settings toggle pre-arms every reply (and reply-all) with a no-reply follow-up (~3 days): the composer's ⏰ toggle starts checked, so unless you opt out, sending the reply schedules the follow-up automatically | ✅ |

## 5. Snooze / Send Later

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Snooze with presets + custom | Yes | Yes — smart presets at exact times + natural-language ("tomorrow 9am") | ✅ |
| Snoozed view & auto-return | Yes | Yes | ✅ |
| Send later (scheduled send) | Yes | Yes — smart presets + natural-language typing, outbox | ✅ |
| Undo send window | Yes | Yes, configurable undo window | ✅ |
| Outbox of scheduled sends | Yes | Yes — with **reschedule** (move a queued send to a new time via the send-later picker) and cancel; local simulation only | ✅ |

## 6. Read statuses

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Read status on sent mail (where provider permits) | Yes | Per-message receipt in the reader + mock parity; documented provider limits | ✅ |
| Read status feed ("Sent & Seen") | Yes (`get_read_status_feed`) | Dedicated view: who/when/device, since-window + pagination, open-rate + "awaiting reply" → one-click follow-up | ✅ |

## 7. Compose

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Fast compose modal (c) | Yes | Yes | ✅ |
| Snippets / text expansion (;shortcut) | Yes | Yes | ✅ |
| Snippet **variables** ({{first_name}}, {{my_name}}, {{date}}…) | Yes | Yes — full variable engine + `{{cursor}}` caret placement | ✅ |
| Reply / Reply all / Forward | Yes | Yes — and they act on the **message you're focused on** in the thread (`j`/`k`), falling back to the latest inbound; Forward can act on any focused message. **Reply all** genuinely fills Cc with everyone else who was on the message (sender → To, the other To + Cc → Cc, you removed and de-duplicated) | ✅ |
| **Reply to your selection** (quote just the highlighted text) | Yes | Yes — highlight a passage in the open conversation and SuperMail shows a contextual **Reply to selection** bar with word count + preview; clicking it (or hitting Reply / per-message ↩) drafts a reply that quotes exactly that selection (`> `-prefixed, indentation preserved) under the attribution line, instead of the whole message; containment-checked to the reader so a selection elsewhere never leaks in, with full-quote fallback when nothing is selected | ✅ |
| **Send & Archive** (reply and move on) | Yes | Yes — replies show a **Send & Archive** button (⌘⇧↵) that queues the reply *and* archives the conversation in one step; an opt-in setting makes the plain Send (⌘↵) do the same for every reply; never archives a new message or a scheduled send, and the archive stays independently undoable | ✅ |
| Autocomplete contacts | Yes | Yes, from contact graph | ✅ |
| CC/BCC toggle | Yes | Yes | ✅ |
| Send later from compose | Yes | Yes | ✅ |
| **Remind me if no reply, from compose** | Yes (set a follow-up as you send) | Yes — a reply's composer carries an **⏰ Remind me if no reply** toggle + duration (1 day / 2 / 3 / 1 week, default 3 days); when the reply actually leaves (so cancelling within the undo window never arms one) a follow-up reminder is placed on the conversation, firing then *unless* they reply first. Shows in Reminders & Today; the send toast confirms "follow-up armed" | ✅ |
| Write with AI in compose | Yes | Yes (local fallback) | ✅ |
| Saved **Drafts** folder (resume / discard) | Yes | Yes — persisted Drafts view, `g d`, edit-in-place, send removes it | ✅ |
| **Signature** auto-inserted (new / reply / forward) | Yes | Yes — editable in Settings, placed above the quoted text with the RFC 3676 `-- ` delimiter; AI drafts use the learned voice sign-off instead | ✅ |
| **Pre-send guardrails** (forgot-attachment, empty subject, bad recipient) | Partial (Gmail-style nudges) | Yes — every send path (Send · Send & Archive · Send Later · ⌘↵) is gated by deterministic checks: no recipient is a hard **block**; a malformed To/Cc/Bcc address, an empty subject or body, the classic "you wrote *attached* but nothing is", a large visible audience (8+ To/Cc — nudges toward Bcc), and an **unfilled template placeholder** (a leftover `{{first_name}}` merge token or a bracketed filler like `[insert link]` / `[date]`) each raise a **warn**. The attachment & placeholder scans read only your fresh text (not the quoted reply trail) and are false-positive-guarded ("attached to the idea", a `[1]` footnote, an `[EXTERNAL]` tag, a markdown `[x]` checkbox never trip them). Warnings surface a **Send anyway / Keep editing** review bar; blockers can't be overridden | ✅ |

## 8. AI

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Auto summarize threads | Yes | Yes — true whole-thread summary (msg/people counts + latest ask), local fallback + provider hook | ✅ |
| **Extract action items from a conversation** ("what is this asking me to do?") | Yes (AI highlights asks) | Yes — the reader shows an **✅ Action items** card listing the concrete asks the open conversation makes of you: a **⏰ deadline** ("…by Friday"), an **✅ explicit request** ("can you review…", "please send…"), or a **❓ direct question**, each pulled only from the sender's *fresh* text (the quoted reply trail is ignored), inbound-only, deduped, false-positive-guarded (a "how are you?" pleasantry, a causal "due to", your own outbound never trip it); click an item to jump to and expand its source message. Also answerable inbox-wide via Ask AI ("what do I need to do?") | ✅ |
| **Surface the commitments you made** ("what did I promise?") | Yes (AI tracks your promises) | Yes — the mirror image of action items: the reader shows a **🤝 Your commitments** card listing the promises *you* made in this conversation's outbound mail — "I'll send the deck **⏰ by Friday**", "let me get back to you", "we'll spin up a sandbox" — pulled only from your *fresh* sent text (the quoted trail ignored), outbound-only, deduped, false-positive-guarded (a question "shall I…?", a negation "I won't be able to…", an ask back "let me know…" never trip it), each flagging whether you named a deadline; click to jump to your message. Also answerable inbox-wide via Ask AI ("what did I promise?") | ✅ |
| "Catch me up" inbox digest | Yes | Yes — `inboxDigest`: unread, needs-reply, awaiting-reply, top senders, newsletters; in Ask panel + palette | ✅ |
| Instant reply suggestions | Yes | Yes | ✅ |
| Write with AI (compose from intent) | Yes | Yes | ✅ |
| **Rewrite / tone-shift** (shorter, longer, formal, casual, fix grammar) | Yes | Yes — deterministic transforms in compose ("Rewrite ▾") | ✅ |
| Ask AI about your inbox (Q&A) | Yes | Yes — a deterministic intent router answering **what's urgent / needs your attention** (ranked by the Focus priority engine, each named with *why*), **what you need to do** (your **action items** — deadlines / requests / questions extracted across the inbox), **what you promised** (your **commitments** — the first-person promises in your own sent mail, deadlines flagged), unread, needs-reply, **what you're waiting on** (threads where your message is the latest, unanswered), **scheduling requests** ("who wants to meet?" — one per thread, with why), **reminders / follow-ups** (due vs upcoming, flags "if no reply"), attachments, starred and by-sender questions, each citing the messages it drew from | ✅ |
| Auto labels | Yes | Yes — per-message suggestions + one-click **bulk "Auto-organize"** (undoable) | ✅ |
| Auto-archive suggestions | Yes | Yes | ✅ |
| Auto follow-up drafts | Yes | Yes | ✅ |
| **Personalization — "learns your voice"** | Yes (`update_personalization`) | Yes — greeting/sign-off/tone/length/personal-facts profile, learned from natural-language feedback, applied to every generator | ✅ |
| Provider behind env vars + deterministic fallback | n/a | Yes (anthropic/openai env, local fallback) | ✅ |

## 9. Gmail integration

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| OAuth 2.0 flow | Yes | Yes, Authorization Code + PKCE + state/nonce hardening | ✅ |
| List / read messages | Yes | Yes, REST adapter + mock parity | ✅ |
| Archive / label / modify | Yes | Yes, REST adapter + mock parity | ✅ |
| Draft creation | Yes | Yes, REST adapter (RFC822 build) + mock parity | ✅ |
| **Sending** | Yes | **Permanently disabled by safety policy** (guard + tests) | 🔒 |
| Mock mode parity for every action | n/a | Yes, identical MailProvider interface | ✅ |
| Token refresh handling | Yes | Yes, refresh + expiry guard | ✅ |

## 9a. Safety boundary (SuperMail-specific)

| Guarantee | Implementation | Status |
|---|---|---|
| `users.messages.send` blocked | `sendMessageRequest` throws; provider `send` throws pre-fetch | ✅ |
| `users.drafts.send` blocked | no builder exists; `assertNotSend` URL guard in `exec` | ✅ |
| Send scopes not requested | `stripSendScopes` removes `gmail.send` from OAuth scopes | ✅ |
| Proven by tests | `src/lib/safety.test.ts` (10 tests) + gmail/provider tests | ✅ |
| Drafts remain human-reviewable | compose "Save draft" only; clear in-app notes | ✅ |

## 10. Product polish

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Dense, work-focused UI | Yes | Yes | ✅ |
| **Themes / appearance** | Yes (signature feature) | Yes — 8 themes (5 dark + 3 light) via a registry-driven engine, visual swatch picker, accent override, compact density, cycle-theme + per-theme palette commands, persisted | ✅ |
| **Get to Inbox Zero / productivity stats** | Yes | Yes — Stats view: inbox-health score, cleared-progress bar, "what to do next", 10 stat tiles, inbox-zero celebration | ✅ |
| Empty / loading / error states | Yes | Yes | ✅ |
| Onboarding | Yes | Yes | ✅ |
| Settings | Yes | Yes (splits, rules, account, AI, privacy) | ✅ |
| Data privacy notes | n/a | Yes, in-app + README | ✅ |
| Local persistence (reload-safe state) | implicit | Yes, versioned localStorage (triage/splits/snippets/outbox/settings) | ✅ |
| **Backup / restore (export & import local data)** | — | Yes (improves on it) — export the whole working set to a timestamped JSON file and import it back, either **Replace** (overwrite) or **Merge** (combine — the file wins on any per-item conflict, but nothing current-only is lost; union by id for mail/labels/snippets, by key for notes/VIPs); validated, version-checked, reloads; contains no credentials | ✅ |
| Tests for core logic | n/a | Yes (mailbox/threads/rules/reminders/sendlater/ai/gmail/persistence) | ✅ |

## 11. Conversation view & threading

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| One row per conversation (not per message) | Yes | Yes, thread grouping engine | ✅ |
| Participants + message-count on the row | Yes | Yes | ✅ |
| Collapsible message history in the reader | Yes | Yes — older messages collapse to one-line headers; click any to expand | ✅ |
| **Expand / collapse the whole thread** | Yes | Yes — an Expand-all / Collapse-all control (and the `o` shortcut + palette) opens or collapses every message at once; opening a thread defaults to just the latest expanded, with a "+N collapsed" hint | ✅ |
| **Keyboard-navigate messages within a thread** | Yes | Yes — in a multi-message conversation, `j` / `k` move between messages (expanding the focused one, scrolling it into view, accent ring), with no wrap at the ends; in the list they still move the row cursor. Opening a thread focuses the latest message | ✅ |
| **Per-message actions (act on one message in a thread)** | Yes | Yes — every expanded message carries its own action row: **↩ Reply** / **⤵ Reply all** (only when there's someone else to copy) on an inbound message, plus **↪ Forward** and **⧉ Copy** (header + body to the clipboard) on any message, yours or theirs; the buttons route to the same composer/clipboard handlers as the keyboard and never open/collapse the message | ✅ |
| Conversation-level triage (archive/star/read/snooze/label whole thread) | Yes | Yes | ✅ |
| Outbound/inbound aware (drives follow-up + read-status) | Yes | Yes | ✅ |
| **Trim quoted reply history** ("show trimmed content") | Yes | Yes — each message shows only what the sender wrote this time; the quoted trail ("On … wrote:", `>`-quotes, Outlook "Original Message"/"From:" blocks) collapses behind a "••• Show trimmed content · N lines" toggle; false-positive-guarded so an ordinary "On Monday…" never trips it | ✅ |
| **Private conversation notes** | Yes (notes) | Yes — per-thread private note in the reader (`n` to add/edit, click-to-edit, Esc/⌘↵ to finish), 📝 row badge, palette command; local-only, never sent, persisted | ✅ |

## 15. Attachments

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Find any attachment fast | Yes | Yes — Attachments hub (`g a`), every file across the mailbox, newest-first | ✅ |
| Search files by name / sender / subject | Yes | Yes, plus a `kind:` / `type:` operator | ✅ |
| File-type awareness (pdf/image/doc/sheet/slide/design…) | Yes | Yes — typed + icon + filter chips with per-kind counts | ✅ |
| Jump to the message that has the file | Yes | Yes (click opens the thread) | ✅ |

## 14. People / contacts

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| People you email, with company/role context | Yes | Yes — contact graph from the mailbox (received/sent/threads/unread/last) | ✅ |
| Search & sort contacts | Yes | Yes (recent / frequent / unread / name) | ✅ |
| VIP / frequent correspondents | Yes | Yes — a frequency + starred heuristic, now **user-overridable**: pin anyone as VIP (or demote a noisy frequent sender) from the reader's sender card or the People profile (★/☆ toggle); the override layers onto the heuristic, feeds the Focus ranking, and is persisted & synced everywhere. A **VIP contacts** manager in Settings lists every manual override and resets any one back to the automatic guess | ✅ |
| Per-person recent conversations | Yes | Yes, click to open | ✅ |
| Compose to a contact | Yes | Yes | ✅ |
| **Sender insight card in the reader ("social insights")** | Yes | Yes — every open conversation shows who it's with (avatar, name, VIP, role · company) and your full relationship history (received / sent / threads / last contact), with one-click **Email** and **History** (deep-links to their People profile); picks the dominant external party in the thread | ✅ |
| **Private notes about a person** | Yes | Yes — a private note that follows the contact across every conversation (e.g. "prefers concise replies", "economic buyer"); editable on both the reader's sender card and the People profile, kept in sync via one persisted, account-agnostic, email-keyed map; local only, never sent | ✅ |

## 13. Unsubscribe, block & spam

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| One-click unsubscribe from list mail | Yes (`unsubscribe`) | Yes — RFC 2369 `List-Unsubscribe` parsing (http + mailto), reader button, palette, banner | ✅ |
| Block sender / block whole domain | Yes | Yes, persisted block list (sender or domain) | ✅ |
| Trash on unsubscribe | Yes | Yes (`alsoTrash` option) | ✅ |
| Auto-archive future mail from a blocked sender | Yes (off the list) | Yes, "N from blocked senders" banner + auto-archive | ✅ |
| Mark as spam | Yes (`mark_spam`) | Yes — label Spam + archive + block sender | ✅ |
| Block-list manager | Yes | Yes, in Settings (view / unblock) | ✅ |
| **Never contacts the sender** | n/a | **Local-only by safety policy** — `contactsSender: false`, proven by tests; the parsed list link is surfaced read-only for the human | 🔒 |

## 12. Calendar & scheduling

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| See upcoming events in-app | Yes | Yes, grouped-by-day calendar view (`g c`) | ✅ |
| "Find a time" across a window | Yes | Yes, working-hours + weekend-aware availability engine | ✅ |
| Honor existing meetings (no double-book) | Yes | Yes, conflict + participant-busy merge | ✅ |
| Send availability (paste-ready slots) | Yes | Yes, "Insert availability" in compose + calendar view | ✅ |
| **Detect a scheduling request → offer availability** | Yes (AI recognizes meeting requests) | Yes — when an open conversation's latest inbound message reads as a meeting ask ("are you free?", "let's grab a call", "share your availability"), the reader shows a **📅 scheduling-request** banner with **why** it triggered and a one-click **Reply with availability** that drafts your open slots — tailored to the inferred meeting length (quick call → 15m, half an hour → 30m, an hour → 60m); conservative + false-positive-guarded (never on your own mail, a bare mention, "feel free", or a quoted trail) | ✅ |
| **Hold a tentative slot from a scheduling request** | Yes (grab time as you read the ask) | Yes — the scheduling-request banner also offers **📌 Hold a slot**: one click blocks the first open working-hours slot (for the *detected* meeting length) on your calendar as a **tentative hold**, linked to the conversation and honored as busy so finding the next free time never double-books it. The banner flips to a two-action held state — **Propose this time** (drafts a reply offering exactly the held slot, "Would Tue 9:00–9:30 work? I've tentatively held it…") + **📌 Holding <when> · Release** (toggle off). The hold shows on the Calendar with a dashed **HOLD** chip + Release button and on **Today** as a 📌 "Tentative hold", and placing one offers an undo. Palette commands too; mock-only — never writes a real calendar | ✅ |
| Hold / schedule a slot | Yes | Yes, in mock calendar (real writes intentionally disabled) | 🔒 |
| Provider parity (mock + live hook) | n/a | `MockCalendarProvider`; Google/MCP mapping documented | ✅ |

## 17. Speed, measured

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| "Every interaction under 100ms" | Claimed (brand promise) | **Measured in-product**: every keyboard triage action is timed keydown → next painted frame; live p50/p95/max in Stats → ⚡ Speed (p50 ~10–17ms, p95 ~32–41ms in headless-Chromium verification of the production build) | ✅ |
| Instant list at any mailbox size | Yes | **Windowed (virtualized) conversation list** — fixed-height rows, exact math (`src/lib/virtualList.ts`): a 6,000-thread mailbox renders ~30 DOM rows, jump-to-bottom is instant, scroll cost is O(viewport) not O(mailbox) | ✅ |
| Keyboard cursor always visible | Yes | **Scroll-follow** (`followScrollTop`): `j`/`k`/`Shift+J` keep the selection pixel-exactly in view — previously the cursor could walk off-screen | ✅ |
| Fast typing in search | Yes | The input renders at keystroke speed; the operator pipeline follows via `useDeferredValue` | ✅ |
| Efficient re-rendering | n/a (closed source) | Quantized 30s UI clock (the memo pipeline stays valid between ticks — it used to re-derive on *every* render via a fresh `Date.now()`), memoized rows behind a stable dispatch ref, one-shot Focus reason map | ✅ |
| Efficient persistence | n/a | Debounced (350ms) whole-state save + `pagehide`/`beforeunload` flush — was a synchronous full-mailbox serialize per action | ✅ |
| Small critical bundle | n/a | Settings / Calendar / People / Today / Shortcut guide / Ask AI are code-split (lazy); critical JS 394KB (131KB gzip) with ~40KB of view chunks on demand | ✅ |
| Reproducible benchmark | — | **Stats → ⚡ Speed → Run 10k benchmark**: a deterministic 10,000-email mailbox through the real pipeline (group → search → rank), ~50ms total / ~20 full passes/sec measured; deterministic generator + injectable clock, unit-tested (`src/lib/perf.ts`) | ✅ |
| No first-paint theme flash | Yes | Persisted theme vars re-applied by an inline `index.html` script before the bundle loads | ✅ |
| Smart time labels | Yes ("9:41 AM") | Cached `Intl` formatters: today → clock time, "Yesterday", same year → "Jun 5", older → "Jun 5, 2025" (`src/lib/timeLabels.ts`) — replaces per-row `toLocaleDateString()` | ✅ |

## 16. Multiple accounts / unified inbox

| Capability | Superhuman | SuperMail | Status |
|---|---|---|---|
| Connect multiple Gmail accounts (work + personal) | Yes | Yes — accounts modeled with id/name/email/color; demo ships a work + personal mailbox | ✅ |
| Unified inbox across all accounts ("All inboxes") | Yes | Yes — `ALL_ACCOUNTS` scope shows every account together; default scope | ✅ |
| Per-account scoping of every view | Yes | Yes — one `scoped` derivation re-scopes inbox, splits, labels, search, reminders, stats, Sent & Seen, People, Attachments, Ask AI | ✅ |
| Account switcher with per-account unread badges | Yes | Yes — sidebar switcher (avatar + name + unread-conversation badge), counts from the full mailbox | ✅ |
| Always-visible active-account context | Yes | Yes — topbar scope pill ("All inboxes" / account name), one click back to unified | ✅ |
| Switch account by command palette | Yes | Yes — "Account: …" commands + persisted active scope | ✅ |
| **Per-account send identity ("From" picker)** | Yes | Yes — Compose "From" selector; replies/forwards auto-pick the conversation's account, new mail uses the active scope; sent mail is attributed to that account | ✅ |
| **Per-account signatures** | Yes | Yes — each account signs with its own block (editable in Settings), swapped live in the draft when you change "From"; global default as fallback | ✅ |
| Triage / reminders work across accounts | Yes | Yes — triage acts by message id on the full set; background reminders/snooze fire account-agnostic | ✅ |
| Add a *new* real account (OAuth) | Yes | Documented opt-in OAuth integration point; never sends mail / mutates a live account | 🔒 |

---

## Shipped backlog (most recent first)

- **Slice 89 (Speed engine: virtualized list, quantized clock, latency HUD,
  10k benchmark, design-system pass)** — made "faster than Superhuman" a
  measured property instead of a vibe, and fixed the systemic render costs that
  had accumulated under the feature work. **Engine:** (1) the UI clock was a
  fresh `Date.now()` *per render*, poisoning every downstream memo — it's now
  state on a 30s tick (+ tab-refocus), so the filter → search → group → rank
  pipeline stays cached between ticks; (2) the conversation list is **windowed**
  (`src/lib/virtualList.ts`: pure `virtualWindow` / `followScrollTop` math,
  fixed-height rows) and split into memoized `ThreadRow`s behind a stable
  dispatch ref — a 6,000-thread mailbox renders ~30 DOM rows and a `j`/`k` move
  repaints exactly two of them, with **pixel-exact scroll-follow** (fixing a
  real bug: the keyboard cursor could walk off-screen); (3) search input goes
  through `useDeferredValue` so typing never blocks on the operator pipeline;
  (4) persistence is debounced (350ms + `pagehide` flush) instead of a
  synchronous full-mailbox serialize per action; (5) per-row
  `toLocaleDateString()` was replaced by cached-formatter **smart time labels**
  ("9:41 AM" / "Yesterday" / "Jun 5" — `src/lib/timeLabels.ts`); (6) Focus
  reasons are computed once per thread set, not twice per row; (7) Settings /
  Calendar / People / Today / ShortcutsGuide / AskPanel are **code-split**
  (critical JS 423KB → 394KB + on-demand chunks); (8) the tab title shows the
  unread count. **Proof:** `src/lib/perf.ts` — every keyboard action is timed
  keydown → next painted frame into a ring buffer (live p50/p95/max in a new
  **Stats → ⚡ Speed** card) and a one-click **10k benchmark** pushes a
  deterministic synthetic mailbox through the real pipeline (injectable clock).
  Headless-Chromium verification of the production build: keystroke p50
  ~10–17ms / p95 ~32–41ms, 10k pipeline ~50ms, 6k-mailbox cold load → rows
  ~500ms, jump-to-row-6000 instant. **Design:** a token pass on styles.css
  (radius/elevation/motion vars, spring easing), frosted-glass overlays with
  pop-in, reader slide-in, toast/bulk-bar/menu micro-motions, themed thin
  scrollbars, `:focus-visible` rings, `prefers-reduced-motion` support, sender
  **avatars** in the list, refined unread/read treatment, centered empty
  states — and a real layout fix (`minmax(0,1fr)` app row) so stacked banners
  can no longer push the list/reader below the fold. A pre-paint inline script
  in `index.html` re-applies the persisted theme so dark-theme users never see
  a white flash; SVG favicon added. +27 tests across three new pure modules
  (now **675 passing**, 57 files); build green; verified end-to-end in headless
  Chromium (keyboard triage, palette, benchmark, theme persistence, 6k-mailbox
  stress).
- **Slice 88 (Live Gmail search from SuperMail queries)** — closed the next real
  mailbox gap: connected Gmail users can now push the current SuperMail search
  to Gmail's server-side search, then merge those live results back into the
  working set. New `src/lib/gmailSearch.ts` wraps the existing parser /
  `toGmailQuery()` mapper, drops impossible local-only searches cleanly, preserves
  server-searchable parts of mixed queries (`from:dana is:meeting` fetches
  `from:dana`, then local filters still narrow the result), and guards normal
  searches with `-in:spam -in:trash` unless the user explicitly searches
  `in:anywhere`, spam or trash. The Search banner now offers **Search Gmail** when
  live Gmail is connected, and the command palette has **Search Gmail live for
  current query**. Results use the same safe snapshot merge and label import as
  Slice 87. +5 tests (now **637 passing**, 53 files); build green; 8 python
  orchestrator tests green.
- **Slice 87 (Live Gmail sync hardening)** — upgraded the real Gmail path from a
  fragile "load 50 and replace local state" scaffold into a safer sync pass for
  `federico.donatone@growthcab.com`. `GmailProvider.list()` now paginates Gmail
  message IDs up to the requested cap, fetches the label catalog once, maps Gmail
  label IDs to display names, resolves user label names back to Gmail label IDs
  before mutations, and persists refreshed access tokens through the browser
  session store. The normalizer now handles quoted-comma address lists,
  multiple To/Cc recipients, `List-Unsubscribe` / one-click unsubscribe headers,
  and attachment filenames from multipart payloads. New `src/lib/gmailSync.ts`
  merges live snapshots into the current working set without losing local-only
  triage state (snooze/reminders/splits/open placeholders) and imports Gmail
  labels without duplicating local labels. App load now syncs up to 250 live
  messages plus labels/profile history into the Growthcab account scope. Safety
  unchanged: `gmail.send` stays stripped and live send endpoints stay blocked;
  draft creation remains the only live write path. +11 tests (now **632
  passing**, 52 files); build green; 8 python orchestrator tests green.
- **Slice 86 (Visible reply-to-selection affordance)** — took the already-safe
  quote-selection engine from hidden power feature to visible workflow. When you
  highlight text inside an expanded message, the reader now shows a compact
  **Reply to selection** bar with selected word count, a normalized preview,
  Reply and Clear. Reply preserves the existing containment guard
  (`readerSelection()` only reads inside `.reader`), quotes exactly the selected
  text, clears the DOM selection after drafting, and still falls back to the
  full message quote when no selection is active. New pure helpers in
  `replyTarget.ts` (`selectionWordCount`, `selectionPreview`) keep UI logic
  deterministic. +2 tests (now **621 passing**, 51 files); build green; 7
  python orchestrator tests green.
- **Slice 85 (Keyboard Speed Coach)** — made the shortcut system trainable, not
  just documented. The `?` guide now opens with a compact **Speed coach** that
  drills the highest-leverage actions first (archive, reply, reply-all, compose,
  snooze, search, next/previous conversation, go-to chords, palette, undo),
  captures real keypresses including multi-key chords, advances away from
  mastered drills, and shows accuracy + current streak. It uses the effective
  shortcut registry, so custom remaps are practiced exactly as they run in the
  app. New pure `src/lib/shortcutCoach.ts` covers drill ordering, chord scoring,
  next-drill selection, and practice stats. +4 tests (now **619 passing**, 51
  files); build green; 7 python orchestrator tests green.
- **Slice 84 (Propose the held time)** — closed the loop on slice 83 so a hold
  is actionable, not a dead-end calendar entry. Once you've held a slot, the
  scheduling-request banner's first action becomes **Propose this time**, which
  drafts a reply offering exactly that slot ("Would Mon, Jun 8 · 9:00–9:30 AM
  (UTC) work for you? I've tentatively held it on my end — just let me know and
  I'll send a calendar invite, or share another time that suits you."). The held
  state is now a clean two-button affordance — *Propose this time* +
  *📌 Holding <when> · Release* — telling a coherent story (detect → hold →
  propose), with "Reply with availability" still one keystroke away in the
  palette (plus a new "Reply proposing the held time" command). New pure
  `heldTimeText(slot, {tzLabel})` in `holds.ts` (the caller adds the greeting,
  mirroring `replyWithTimes`); App's `replyWithHeldTime` routes it through the
  existing `startReply`. +2 tests (now **615 passing**, 50 files); build green;
  7 python orchestrator tests green.
- **Slice 83 (Hold a tentative slot from the meeting banner)** — one of
  Superhuman's signature meeting touches: when someone asks to meet, grab the
  time *as you read the ask*, before the exact slot is nailed down. The
  scheduling-request banner (slices 66–69) now carries a second action, **📌 Hold
  a slot**, beside "Reply with availability". One click runs the existing
  availability engine to find the first open working-hours slot for the
  *detected* meeting length and places a **tentative hold** on your calendar —
  an ordinary event flagged `tentative` and linked to the conversation
  (`holdThreadId`), so it's honored as busy when finding the next open time (your
  own holds never double-book) and can be found / summarized / released. The
  banner is a toggle: once held it reads **📌 Holding Tue, Jun 9 · 9:00–9:30 AM ·
  Release**. The hold surfaces everywhere a calendar event does — on the
  **Calendar** with a dashed border, a **HOLD** chip and a Release button, and on
  **Today** as a 📌 "Tentative hold" row — and placing one offers an undo. New
  pure `src/lib/holds.ts` (`proposeHoldSlot` / `buildHold` / `findHoldForThread` /
  `holdTitle` / `holdSummary` / `isHold`, all deterministic — the search instant
  is injected) plus `removeEvent` and two new optional `CalendarEvent` fields in
  the well-tested `calendar.ts`; agenda labels holds distinctly. Palette command
  added. SAFETY unchanged: mock calendar only, never writes a real calendar,
  never sends. +21 tests (18 holds + 2 calendar + 1 agenda; now **613 passing**,
  50 files); build green; 7 python orchestrator tests green.
- **Slice 82 (Search by who's copied — `cc:`)** — closed a plain Gmail-parity
  gap in the query language: it had `from:` and `to:` but no **`cc:`**, so
  "which threads is Marcus copied on?" wasn't expressible. Added a `cc:` operator
  that matches any party in a message's Cc list by name or email (`cc:marcus`,
  `cc:nw.dev`), composable with every other operator and negation
  (`cc:marcus -is:read`, `-cc:legal`) and saveable as a smart view. It reads
  `email.cc` (the same `Contact[]` reply-all already fills) and is null-safe, so a
  message with no Cc simply never matches. Unlike the SuperMail-local virtual
  filters, `cc:` has a native Gmail equivalent, so `toGmailQuery` emits it
  verbatim (`cc:marcus`, negation preserved) and the REST adapter runs the
  identical query server-side. Pure addition to the well-tested `search.ts` (zero
  App wiring — the search box passes through); operator help + module doc updated.
  +4 tests (now **588 passing**); build green.
- **Slice 81 (Sweep your newsletters — `is:newsletter`)** — a power-user inbox
  staple: pull up every bulk / mailing-list message in one query so you can
  triage or unsubscribe in a batch. A new **`is:newsletter`** operator (aliases
  **`is:bulk`** / **`is:list`**) reuses the already-tested `isBulkMail` detector
  from `unsubscribe.ts` — it matches any message carrying a `List-Unsubscribe`
  header, a `news` / `social` category, an automated sender (`no-reply@`,
  `marketing@`, `newsletter@`…), or an "unsubscribe" footer, while never firing
  on your own outbound mail. Composable with every other operator and negation
  (`is:newsletter older_than:7d`, `is:newsletter -from:substack`,
  `-is:newsletter` to hide the noise) and saveable as a smart view. Like the
  other SuperMail-local virtual filters it's dropped from the Gmail `q`
  translation — Gmail's nearest is `category:promotions`, which is narrower, so
  translating would mislead; the REST adapter never emits an operator Gmail would
  mishandle. Pure addition to the well-tested `search.ts` (zero App wiring — the
  search box passes through); operator help updated. +5 tests (now **584
  passing**); build green.
- **Slice 80 (Find the email with the link — `has:link`)** — a power-user
  search staple that was missing: "where's that email with the doc / Figma /
  Notion link?". A new **`has:link`** operator (alias **`has:url`** / `has:links`)
  matches any message whose body carries a URL, composable with every other
  operator and negation (`has:link from:dana`, `has:link -is:read`,
  `has:link newer_than:7d`). The detector is deliberately conservative — it
  matches only an explicit `http(s)://` scheme or a `www.` prefix, never a bare
  domain, so an email address ("dana@acme.io") or a stray "acme.io" mention never
  reads as a link (the project's false-positive-guarded house style). Like the
  other SuperMail-local virtual filters it's dropped from the Gmail `q`
  translation (Gmail has no `has:link`), so the REST adapter never emits an
  operator Gmail would reject, while `has:attachment` keeps mapping through. Pure
  addition to the well-tested `search.ts` (zero App wiring — the search box passes
  through); operator help updated. +5 tests (now **579 passing**); build green.
- **Slice 79 (Seed a "Promised" smart view)** — closes the discoverability loop
  on slice 78 exactly as slices 73 & 76 did for `is:meeting` / `is:actionable`:
  `is:committed` is powerful but you had to know to type it. Added it to the
  default saved searches as a **🤝 Promised** starter view, so a fresh inbox
  surfaces every promise you've made in the sidebar with a live count, one click
  away (the saved-search runner already understands `is:committed` — data only,
  no wiring). +1 test (now **574 passing**); build green.
- **Slice 78 (Find your promises across the inbox — `is:committed`)** — the
  inbox-wide companion to slice 77, exactly as `is:actionable` (slice 75)
  generalized the action-item detector. A new **`is:committed`** search operator
  (alias **`is:promised`**) matches any outbound message the commitment detector
  reads as a promise you made, so you can pull up your whole "things I said I'd
  do" pile in one query — composable with every operator and negation
  (`is:committed older_than:2d`, `is:committed to:jordan`) and saveable as a smart
  view. Like `is:meeting` / `is:actionable` it's a SuperMail-local virtual filter
  dropped from the Gmail `q` translation (no server equivalent), so the REST
  adapter never emits it. Pure addition to the well-tested `search.ts` (zero App
  wiring); operator help updated. +5 tests (now **573 passing**); build green.
- **Slice 77 (Surface the commitments you made — "what did I promise?")** — the
  natural mirror of slice 74's action items, and a signature Superhuman touch the
  product didn't have: where action items surface what *others* ask of *you*,
  commitments surface the promises *you* made. New pure
  `src/lib/commitments.ts`: `extractCommitments(messages, selfEmail?)` scans each
  **outbound** message's *fresh* text (via `splitQuoted`, so a quoted trail never
  counts) and keeps the sentences that read as a first-person future promise —
  "**I'll** send the deck", "**we'll** spin up a sandbox", "**let me** dig into
  the numbers" — flagging the ones that named a time-bound (`hasDeadline`).
  Conservative + false-positive-guarded: a question ("shall I send it?"), a
  negation ("I won't be able to…"), the ask-back "let me know…", and any inbound
  message never trip it; inbound-only would be the wrong word — it's *outbound*-
  only (your own sent mail, identified by the `outbound` flag or your
  `selfEmail`), deduped, freshest-message-first, capped at six. The reader renders
  a **🤝 Your commitments** card under the AI summary (each row a clickable jump to
  your message, ⏰ when you set a deadline), and the same engine powers a new
  **Ask AI** intent ("what did I promise?", "my commitments", "what am I on the
  hook for?") that lists your promises across the whole inbox, citing them.
  Ask-panel suggestion chip + fallback help updated; out of the box it catches the
  seeded "we'll spin up a sandbox" in the Jordan pilot thread. +13 tests (12 lib +
  1 ai; now **568 passing**); build green.
- **Slice 76 (Seed a "Needs an action" smart view)** — closes the
  discoverability gap on slice 75 exactly as slice 73 did for `is:meeting`:
  `is:actionable` is powerful but you had to know to type it. Added it to the
  default saved searches as a **✅ Needs an action** starter view, so a fresh
  inbox surfaces everything asking something of you in the sidebar with a live
  count, one click away (the saved-search runner already understands
  `is:actionable` — data only, no wiring). This also surfaced and fixed a real
  detector false-positive: the common **"FYI — no action needed"** / "no reply
  required" footer was being read as a to-do (the `action needed` request
  pattern fired on the *negated* phrase); `actionItems` now has a non-ask guard
  so an explicitly-negated footer never becomes an action item. +2 tests (1
  saved-search default + 1 non-ask guard; now **555 passing**); build green.
- **Slice 75 (Find everything that asks something of you — `is:actionable`)** —
  a natural inbox-wide companion to slice 74, exactly as `is:meeting` (slice 67)
  generalized the meeting detector. A new **`is:actionable`** search operator
  (alias **`is:ask`**) matches any inbound message the action-item detector
  reads as an ask — a deadline, an explicit request, or a direct question — so
  you can pull up your whole "someone needs something from me" pile in one query,
  composable with every other operator and negation (`is:actionable
  -from:newsletter`, `is:actionable older_than:2d`) and saveable as a smart view.
  Like `is:meeting` it's a SuperMail-local virtual filter dropped from the Gmail
  `q` translation (no server equivalent), so the REST adapter never emits it.
  Pure addition to the well-tested `search.ts` (the search box passes through —
  zero App wiring); operator help updated. +5 tests (now **553 passing**); build
  green.
- **Slice 74 (Extract action items from a conversation)** — a signature
  Superhuman AI touch the product didn't have yet: surfacing *what an email is
  asking you to do*. New pure `src/lib/actionItems.ts`:
  `extractActionItems(messages, selfEmail?)` scans each inbound message's
  **fresh** text (via `splitQuoted`, so a quoted reply trail never counts),
  splits it into candidate sentences (line breaks + terminators, bullets
  stripped), and keeps the ones that read as an ask addressed to you —
  classified, in precedence order, as a **deadline** ("…by Friday", "due EOD",
  "no later than", guarded against the causal "due to"), an explicit **request**
  ("can you…", "please review…", "let me know…", "don't forget…"), or a real
  **question** (ends with `?`, mentions you / opens with an interrogative, with a
  pleasantry stoplist so "how are you?" / "sounds good?" are ignored). Inbound
  only (never your own outbound, never the reader's own address), deduped,
  freshest-message-first, capped at six. The reader renders an **✅ Action
  items** card under the AI summary — each item a clickable row with a kind icon
  (⏰ / ✅ / ❓) that jumps to and expands its source message — and the same engine
  powers a new **Ask AI** intent ("what do I need to do?", "action items",
  "to-do", "tasks") that lists the asks across the whole inbox, citing them
  (placed before the needs-reply branch, which was narrowed accordingly).
  Ask-panel suggestion chip added. +16 tests (14 lib + 2 ai; now **548
  passing**); build green.
- **Slice 73 (Seed a "Scheduling requests" smart view)** — the `is:meeting`
  search operator (slice 67) was powerful but undiscoverable; you had to know to
  type it. Added it to the default saved searches as a **📅 Scheduling requests**
  starter view, so a fresh inbox surfaces every open meeting ask in the sidebar
  with a live count, one click away — no wiring beyond the data (the saved-search
  runner already understands `is:meeting`). +1 test (now **532 passing**); build
  green.
- **Slice 72 (Flip through conversations from the reader — Shift+J / Shift+K)** —
  a core Superhuman speed flow that was missing: while reading a conversation,
  pressing `j`/`k` only moved the list cursor *behind* the reader (slice 45 gave
  them in-thread message navigation), so there was no way to advance to the next
  conversation without going back to the list. Added **Shift+J / Shift+K** =
  "next / previous conversation (and open it)", so you stay in the reader and fly
  through the inbox. New pure `neighborIndex(length, current, dir)` in
  `navigation.ts` (clamped, no wrap, handles an unselected cursor) is the kernel;
  `openNeighborThread` anchors on the thread you're reading (else the list
  cursor), steps one, and opens it (marking it read, resetting the reader's
  message focus via the existing effects). Wired as two registry shortcuts (so
  they show in the `?` guide and are rebindable), runAction cases, and palette
  commands. The mental model is clean: lowercase j/k = small move (row / message),
  Shift+J/K = big move (whole conversation). +5 tests (now **531 passing**); build
  green.
- **Slice 71 (Ask-inbox: "what's urgent / needs my attention?")** — the Q&A
  router answered "what's important / priority" by listing *starred* mail, which
  undersold the work already in the product: SuperMail has a real attention
  ranker (the slice-38 **Focus** engine). The "important / priority / urgent /
  attention / focus / on fire / most important" intent now runs that engine —
  `focusThreads(groupThreads(live))` — and reports the top threads that cross the
  attention threshold, each named with **why** (unread / ball-in-your-court /
  direct ask / scheduling request…), exactly as the Focus view tags them, with a
  clean "nothing urgent — your inbox is calm" when nothing qualifies. The literal
  **"what's starred?"** question stays a starred list (the branch was narrowed to
  `starred|flagged`, with a regression test). Ask-panel suggestion chip ("What
  needs my attention?") + fallback help updated. +3 tests (now **526 passing**);
  build green.
- **Slice 70 (Pre-send guard: unfilled template placeholders)** — a real
  Superhuman/Gmail-grade "wait, you left a blank in here" catch, and the kind of
  mistake you only notice *after* it sends. `composeChecks` now raises a **warn**
  when the fresh text or subject still contains an unfilled placeholder — either
  a leftover merge token (`{{first_name}}`, `{{company}}`, `{{date}}` — what
  survives when a snippet variable can't be filled) or a bracketed filler keyed
  on a curated word list (`[first name]`, `[insert link here]`, `[date]`,
  `[TODO]`…). It's high-precision: the bracket match requires a known filler
  word, so an ordinary `[1]` footnote, an `[EXTERNAL]` subject tag or a markdown
  `[x]` checkbox is left alone, and — like the forgot-attachment nudge — it scans
  only what you wrote *this time* (via `splitQuoted`), so a `{{token}}` sitting in
  someone's quoted signature below never trips it. Surfaces through the existing
  send-review bar (Send anyway / Keep editing) — zero new UI. +6 tests (now
  **523 passing**); build green.
- **Slice 69 (Instant replies use the precise meeting detector)** — a small
  accuracy + consistency win: `instantReplies` gated its "let's find time" /
  "calendar invite" suggestions on a loose keyword test (`asksForMeeting` —
  which fires on a bare "call"/"chat"/"sync"), so a *mention* like "thanks for
  the call earlier" wrongly offered a scheduling reply. It now uses the
  false-positive-guarded `detectMeetingRequest` (slice 66) instead, and lets the
  detected length shape the proposal ("could we find **15 minutes**" for a quick
  call, 30 by default). The looser `asksForMeeting` stays where a broad net is
  wanted (the "needs a reply?" branches). +1 test (now **517 passing**); build
  green.
- **Slice 68 (Scheduling requests rank in Focus)** — the third use of the
  slice-66 detector, closing the loop: an unanswered meeting ask is exactly the
  kind of thing the **Focus** view exists to surface, so `threadPriority` now
  adds a **"Scheduling request"** signal (+18) when the latest message is an
  inbound meeting request. It's made *mutually exclusive* with the generic
  "Direct ask" (+15) so the two never double-count, and it's scored a notch
  higher so a concrete "are you free Thursday?" floats above a vaguer "can you
  take a look?". Pure-lib only — the Focus reason chips and ranking recompute
  from `threadPriority`, so the new driver flows through with no App wiring;
  guarded so your own outbound scheduling note never trips it. +2 tests (now
  **516 passing**); build green.
- **Slice 67 (Find scheduling requests across the inbox)** — the slice-66
  detector only surfaced a meeting ask once you *opened* the thread. This makes
  it inbox-wide, two ways, both powered by the same `detectMeetingRequest`.
  (1) A new **`is:meeting`** search operator — a SuperMail-local virtual filter
  that matches any inbound message reading as a scheduling request, composable
  with every other operator and negation (`is:meeting -from:newsletter`),
  saveable as a smart view; it's intentionally dropped from the Gmail `q`
  translation (no server equivalent) so the REST adapter never emits an operator
  Gmail rejects. (2) A new **Ask-inbox intent** — "any scheduling requests?" /
  "who wants to meet?" lists the threads where someone's asking to meet (one row
  per thread, newest first, each tagged with *why* it matched), citing the
  messages, with a clean empty answer. Ask-panel suggestion chip + fallback help
  updated. The intent sits before the reminders branch and its trigger is scoped
  to scheduling phrasing so it never shadows unread / needs-reply / waiting-on /
  reminders. +6 tests (4 search + 2 ai; now **514 passing**); build green.
- **Slice 66 (Detect a scheduling request → one-click availability reply)** —
  one of Superhuman's signature AI touches is recognizing when an email is
  *asking to meet* and offering to insert your times. New pure
  `src/lib/meetingIntent.ts`: `detectMeetingRequest(email)` scans only the
  sender's **fresh** text (subject + the un-quoted body via `splitQuoted`) for a
  curated set of scheduling signals — "are you free", "share your availability",
  "let's catch up", "schedule a call", "hop on a quick call", "touch base",
  "grab coffee", a guarded "quick call?" — and returns up to two short,
  human-readable reasons plus an inferred meeting length ("quick call" → 15,
  "half an hour" → 30, "an hour" → 60, default 30). It is deliberately
  conservative and false-positive-guarded: it never fires on our own outbound
  message, on a bare *mention* ("the meeting went well", "great call earlier"),
  on "feel free" / "free trial", or on a "let's meet" buried in the quoted reply
  trail. `meetingRequestInThread(messages)` returns the latest inbound request in
  an open conversation. Wired into the reader as a green **📅 "Looks like a
  scheduling request — <why>"** banner under the AI summary with a **Reply with
  availability** button that drafts a reply pre-filled with your open slots —
  reusing the existing calendar availability engine (`findAvailability` /
  `formatAvailabilityText`), now tailored to the detected duration
  (`availabilityText` / `replyWithTimes` gained an optional minutes argument).
  Shows out of the box on the Dana roadmap thread ("happy to jump on a quick
  call"). +20 tests (now **508 passing**); build green.
- **Slice 65 (Ask-inbox: "what am I waiting on?")** — a companion to slice 64 and
  the natural inverse of "what needs a reply?". A new `askInbox` intent (triggers
  on *waiting on/for*, *awaiting*, *heard back*, *chase*, *haven't heard/replied*,
  *who hasn't replied*, *owe me*) lists the threads where **your** message is the
  latest and unanswered — i.e. the ball is in their court — naming who each is to.
  It reuses the exported `awaitingReplyMessages` (the same thread-grouped logic
  the "Catch me up" digest uses) so the two never diverge, and is ordered after
  the "waiting on me" → needs-reply branch so the two senses stay distinct. Ask
  suggestion chip + fallback help updated. +2 tests (now **488 passing**); build
  green.
- **Slice 64 (Ask-inbox: reminders & follow-ups)** — the `askInbox` Q&A router
  answered unread / needs-reply / attachments / starred / by-sender but had no
  branch for the question this iteration made most relevant: "what follow-ups do
  I have?". Added a reminders intent (triggers on *reminder(s)*, *follow-up(s)*,
  *remind me*, *what's due*) that lists every reminder-bearing thread, split into
  **due now** vs **upcoming** (soonest first), flags the "if no reply" variant,
  cites the threads, and reports cleanly when none are set. Pure-lib + the Ask
  panel's suggestion chips and fallback help updated — zero App wiring (AskPanel
  already routes to `askInbox`). +2 tests (now **486 passing**); build green.
- **Slice 63 (Wire the "Your name" setting)** — small correctness/polish:
  `settings.selfName` was editable in Settings and persisted but consumed
  nowhere. It now drives the sender identity on locally-sent mail —
  `outboxToEmail(item, accounts, {name, email})` falls back to the user's
  Settings name/email instead of a hardcoded "You" / placeholder address — so a
  sent message from an unnamed account shows your real name. Removed the
  hardcoded fallback email too. No new pure logic (UI/identity wiring; still
  **484 passing**); build green.
- **Slice 62 (Auto follow-up by default)** — the global "never drop the ball"
  switch on top of slices 58–59. New `AppSettings.autoFollowUp` (default false,
  back-filled by `resolveSettings` so old blobs are safe). When on, `startReply`
  and `startReplyAll` are born with `followUpMs = DEFAULT_FOLLOW_UP_MS`, so the
  composer's ⏰ "Remind me if no reply" toggle starts checked and — unless you opt
  out — sending the reply arms the follow-up automatically (via the slice-59
  outbox-tick path). Settings toggle next to "reply & move on". +1 persistence
  test (now **484 passing**); build green.
- **Slice 61 (Reply to your selection)** — Superhuman/Gmail quote only the text
  you highlighted when you reply. New pure `quoteText(selected)` in
  `quotedText.ts` prefixes each line of a selection with `> ` (blank lines → bare
  `>`, indentation preserved, CRLF normalized, "" for empty). A DOM-reading
  `readerSelection()` in App returns the current selection **only when it lives
  inside the `.reader` pane** (containment-checked via `closest(".reader")`), so a
  selection in the composer/sidebar/menu never leaks into a reply. `startReply`
  gained an optional third `quoteSelection` arg (existing callers unaffected):
  when present it quotes that passage under the usual "On … wrote:" attribution
  instead of the message preview, falling back to the full quote when empty. Wired
  into the keyboard `r` (the primary flow — select, press R), the reader Reply
  button, and the per-message ↩ action. +5 tests (now **483 passing**); build
  green.
- **Slice 60 (Bulk "Mark unread" + bulk "Remind")** — rounded out the
  multi-select action bar, which had Archive / Delete / Mark read / Star /
  Snooze… / Label… / Move… but no way to *un*-read a batch or remind a batch.
  **Mark unread** is a trivial `bulkApply` (`read: false`). **Remind…** opens the
  same `RemindPicker` (smart presets + natural-language + the if-no-reply toggle)
  in bulk mode; picking a time routes through a new `bulkRemind`, which — unlike
  the other bulk actions that touch every message in a thread — places exactly
  **one** reminder per selected conversation, on its latest message, because the
  Reminders view lists every message that carries a reminder (so per-message
  arming would duplicate rows). One undoable step each. UI wiring over the
  already-tested `setReminder` primitive (still **478 passing**); build green.
- **Slice 59 (Remind me if no reply — from the composer)** — the user-facing
  payoff of slice 58: a reply's composer now carries an **⏰ Remind me if no
  reply** toggle with a duration (1 day / 2 / 3 / 1 week, default 3 days), riding
  on the draft as `followUpMs` (like `scheduledAt`). New pure
  `armFollowUp(emails, threadId, inReplyTo, ms, now)` in `reminders.ts` decides
  where to anchor the follow-up — the message you replied to, or the latest in
  the thread — and returns `{anchorId, reminderAt, reminderSetAt}`. It's applied
  in the **outbox tick** the moment the reply actually leaves, so cancelling
  within the undo window never arms one; the cutoff is set at send time, so any
  inbound reply afterward cancels it (via the slice-58 semantics). The send toast
  confirms "follow-up armed", and the reminder shows in Reminders & Today. +3
  tests, plus `.compose-followup` CSS (now **478 passing**); build green.
- **Slice 58 (Fix "remind me if no reply" semantics)** — a real correctness fix.
  The follow-up's "did they reply?" check measured replies *after the fire time*,
  so a reply arriving **before** the reminder was due slipped through and the
  follow-up fired anyway. Added `Email.reminderSetAt` (when you started waiting)
  and switched `reminderDue`'s cutoff to it via a new `replyCutoff(email)` helper,
  with a safe fallback to `reminderAt` so legacy reminders are unchanged.
  `setReminder` now stamps the set-time; `setReminderAt` takes an optional one;
  `clearReminder` clears it; rescheduling resets it to now. The field rides
  persistence automatically (emails persist wholesale). +5 tests; build green.
- **Slice 57 (Richer search operators)** — pure additions to the well-tested
  `search.ts` query engine, no App change (the search box passes through). Two
  new `is:` states that map real mailbox flags Gmail/Superhuman users expect to
  filter on — **`is:pinned`** and **`is:muted`** — and the Gmail-familiar
  relative-date aliases **`newer_than:`** / **`older_than:`** (e.g.
  `newer_than:7d`, `older_than:2w`), which reuse the existing `parseDateValue`
  (Nd/Nw/Nh) and matcher logic as `after:` / `before:` and translate to Gmail's
  native `after:` / `before:` with an absolute date in `toGmailQuery`. Updated
  the in-UI operator help. +4 tests (now **470 passing**); build green.
- **Slice 56 (Merge on import — additive restore)** — importing a backup (slice
  49) only ever *replaced* the current state, throwing away anything not in the
  file. New pure `mergeStates(current, imported)` in `persistence.ts` (plus the
  generic `mergeById` and a private `mergeObject`): the imported snapshot wins on
  any per-item conflict — same email id (its triage state), same label / snippet
  / saved-search / account id, same note / contact-note / VIP / keymap key — but
  every current-only item is kept, so pulling in a backup or another machine's
  data is additive, not destructive. Arrays union by id (blocks by `value`),
  maps/settings shallow-union, and the result is always stamped with the live
  `STORAGE_VERSION`. The Settings "Backup & restore" card now offers **Import
  (replace)…** and **Merge backup…**; `importData(json, mode)` reads the current
  state back from storage (kept in sync by the save effect), merges, and reloads.
  +6 tests (now **466 passing**); build green.
- **Slice 55 (Bulk "Move to split")** — the multi-select action bar already
  offered Archive / Delete / Mark read / Star / Snooze… / Label…, but not the
  manual **Move to split** that slice 34 gave a single conversation. Added a
  **Move…** button that opens the same split picker in bulk mode; picking a lane
  routes through a new `bulkMove` (a one-liner over the existing `bulkApply` +
  `assignSplit`), reassigning every selected conversation — or clearing back to
  rule-based with **↺ Auto** — as one undoable step. The picker's `move` branch
  now mirrors the `label` / `snooze` branches (bulk header, no per-thread
  checkmarks in bulk mode). No new pure logic — composes the already-tested
  `assignSplit` + `bulkApply`; build green (still **460 passing**).
- **Slice 54 (Per-message actions + a real Reply all)** — Gmail and Superhuman
  attach an action set to *every message* in a thread, not just the conversation
  as a whole. New pure `src/lib/messageActions.ts`: `messageActions(m, selfEmail)`
  returns the ordered set a message offers — **↩ Reply** and (only when there's
  someone else to copy) **⤵ Reply all** on an inbound message, plus **↪ Forward**
  and **⧉ Copy** on any message (yours or theirs); `replyAllParticipants` /
  `replyAllRecipients` build the reply-all recipient split (sender → To, the other
  To + Cc → Cc, you removed and de-duplicated case-insensitively); and
  `messagePlainText` renders a message (header + body) for the clipboard. Each
  expanded message now shows a compact action row that routes to the **same**
  composer/clipboard handlers as the keyboard (the buttons `stopPropagation` so
  they never also open/collapse the message). This also **fixed a latent bug**:
  the keyboard `reply-all` action was a no-op alias for Reply that never actually
  CC'd anyone — it now fills Cc properly via the new `startReplyAll`. The
  per-message Forward and the keyboard Forward share one `forwardEmail` helper.
  Seeded a Cc onto Dana's latest message so Reply all is demonstrable out of the
  box. +11 tests (now **460 passing**); build green.
- **Slice 53 (Large-audience nudge — Bcc for big groups)** — a focused follow-on
  to the slice-51 compose guardrails: `composeChecks` now warns when a draft's
  *visible* audience (To + Cc, threshold `MANY_RECIPIENTS = 8`) is large,
  suggesting Bcc to keep a big list private and avoid a reply-all storm — a
  recognized Gmail/Outlook safety prompt. Bcc itself is excluded from the count
  (it's already the right tool). No new UI: the existing send-review bar renders
  it like every other warn, so it inherits "Send anyway / Keep editing". +3
  tests (now **449 passing**); build green.
- **Slice 52 (Today agenda quick-actions — act, don't just look)** — the Today
  view (slice 44) pulled every time-anchored thing onto one timeline, but you
  could only *open* a row; a daily agenda you can't act on is half a feature.
  New pure `src/lib/agendaActions.ts`: `agendaActions(item)` returns the one
  secondary action that fits each item kind — **✓ Done** on a reminder /
  follow-up (clears it — it's handled), **⏪ Return now** on a snoozed
  conversation (back to the inbox immediately), **✕ Cancel** on a scheduled send
  — and nothing on a calendar event (we never mutate a real calendar), plus
  `hasAgendaActions`. Each Today row now renders its action(s) next to the kind
  chip (click `stopPropagation`s so it never also opens the row). The App's
  `onAgendaAction` maps each id to the **same** primitive the Reminders /
  Snoozed / Outbox views already use — `mutate(reminderAt:null)`,
  `mutateThread(snoozedUntil:null)`, `cancelSend(outbox)` — so they're single,
  undoable (or cancelable) actions that never drift from those views. +6 tests
  (now **446 passing**); build green.
- **Slice 51 (Pre-send guardrails — forgot-attachment & send safety)** — the
  composer fired a send the instant you hit ⌘↵ with no safety net, so an empty
  subject, a typo'd recipient, or the classic "see attached" with nothing
  attached went out (well, *simulated* out) unchecked. New pure
  `src/lib/composeChecks.ts`: `composeChecks(draft)` returns a list of
  `{ code, level, message }` results — **block** (no recipient — genuinely can't
  send) or **warn** (a malformed To/Cc/Bcc address, an empty subject, an empty
  body, or an attachment promised but not attached). The forgot-attachment scan
  is the careful part: it reads only the *fresh* text you wrote this time (via
  `splitQuoted`, so a "please find attached" sitting in the quoted reply trail
  never trips it) plus the subject, keys on a curated set of unambiguous phrases
  ("see attached", "i've attached", "PFA" as a standalone token, "enclosed
  is"…), and is false-positive-guarded so "I'm attached to this idea" or
  "pfander" stay silent. Since SuperMail drafts are review-only and never carry
  files, the nudge always points you back to Gmail to attach before sending.
  Wired into **every** send path in `Compose` — Send, Send & Archive, Send
  Later, and the ⌘↵ / ⌘⇧↵ keyboard sends — through one `guard()` gate: a clean
  draft sends immediately; otherwise a **review bar** lists the issues with
  **Send anyway** (warns only) / **Keep editing**, and ⌘↵ confirms it while Esc
  dismisses it. `execute()` re-reads the live draft so fixing the problem and
  re-sending just works. +17 tests (now **440 passing**); build green.
- **Slice 50 (Reply / Forward act on the focused message)** — building on the
  in-thread `j`/`k` navigation (slice 45), Reply and Forward now respect which
  message you're looking at. New pure `src/lib/replyTarget.ts`:
  `replyTargetMessage(messages, focusedId)` returns the focused message when it's
  inbound (you reply *to* someone), otherwise the latest inbound, otherwise the
  latest — and `focusedOrLatest` for Forward (which may act on your own message).
  Wired into the `r` / `a` / `f` shortcuts and the reader's Reply button (via a
  `focusedMsgIdRef` so no key-handler dep churn). +8 tests (now **423 passing**);
  build green.
- **Slice 49 (Local data export / import — backup & migrate)** — SuperMail is
  local-first, so the whole working set lived in one browser with no way to back
  it up or move it. New pure `serializeState(partial, nowIso?)` (pretty JSON
  snapshot) and `parseImportedState(json)` (reuses the defensive `sanitize`, so a
  garbage or version-mismatched file returns null) in `persistence.ts`. A new
  **Backup & restore** card in Settings: **Export data (JSON)** downloads a
  timestamped file; **Import data…** reads a file, validates it, persists it and
  reloads to rehydrate cleanly. The snapshot contains only local data (triage,
  splits, snippets, labels, notes, reminders, settings) — never passwords, OAuth
  tokens or any credential, since those are never persisted. +3 tests (now **415
  passing**); build green.
- **Slice 48 (Reschedule a reminder)** — the Reminders view could open, clear or
  draft a follow-up, but not change *when* a reminder fires. Each reminder row
  now has a **Reschedule** button that drops down the shared `RemindPicker`
  (smart presets + natural-language typing + the "only if no reply" follow-up
  toggle); picking a time rewrites the reminder in place as one undoable action.
  Pure logic reused (`setReminderAt` / `mutate`); no new lib needed. Build green
  (still **412 passing**).
- **Slice 47 (Reschedule a queued Send Later)** — Superhuman lets you move a
  scheduled send; SuperMail only offered Cancel. New pure
  `reschedule(outbox, id, iso)` in `sendLater.ts` updates a still-**scheduled**
  item's `sendAt` (and keeps the draft's `scheduledAt` in sync), returning the
  same array reference on a no-op (unknown id / same time / already sent) so
  React skips the re-render. The Outbox view gained a **Reschedule** control
  (shown only for sends more than a minute out, never one inside its 10s undo
  window) that drops down the shared send-later `TimePicker`. Still a 100% local
  simulation — real delivery stays permanently disabled. +2 tests (now **412
  passing**); build green.
- **Slice 46 (VIP management surface in Settings)** — manual VIP pins/demotes
  (slice 41) could only be made from a sender card or the People view and never
  reviewed in one place. New **VIP contacts** card in Settings lists every manual
  override resolved to a display name (pinned ★ VIP first, then demoted), each
  with a **Reset to auto** button that drops the override back to the heuristic
  (`clearVip`). Account-scoped name resolution via the contact graph. Closes the
  loop on the previously-unused `manualVipCount`/override surface. Build green
  (**410 passing**).
- **Slice 45 (In-thread message keyboard navigation)** — Superhuman/Gmail let
  you move between the messages *inside* an open conversation. New pure
  `src/lib/messageNav.ts` (`neighborId` with no-wrap edge clamping,
  `initialFocusId` = latest, `focusIndex`/`atFirst`/`atLast`). When a
  multi-message thread is open, **j/k move the focused message** (expanding it
  and scrolling it into view) instead of the conversation list; in the list they
  still move the row cursor. The focused message gets an accent ring; clicking a
  message header focuses it too. Opening a thread focuses the latest message
  (the one expanded by default). +9 tests (now **410 passing**); build green.
- **Slice 44 (Today — unified daily agenda)** — a brand-new view that improves on
  Superhuman by pulling every time-anchored thing onto one timeline: calendar
  events still ahead, reminders / follow-ups about to fire, snoozed
  conversations returning, and scheduled "send later" messages. New pure
  `src/lib/agenda.ts`: `buildAgenda({emails, events, outbox}, now)` produces a
  sorted, de-duplicated (one row per thread) item list — a replied "remind if no
  reply" is dropped, a past event is excluded, an all-day event stays through
  end-of-day; `groupAgendaByDay` buckets a leading **Overdue** group (any
  past-due task-like item, even from this morning) then **Today / Tomorrow /
  date** days; `agendaSummary`, `agendaTodayCount` (sidebar badge) and
  `agendaTimeText` (UTC, consistent with the Calendar). New **🗓 Today** sidebar
  item with a count badge, a `g t` chord and a palette command; the `TodayView`
  renders day sections with colored kind chips, and clicking a row opens the
  thread / Calendar / Outbox. +11 tests (now **401 passing**); build green.
- **Slice 43 (Redo — Cmd+Shift+Z)** — the triage flow had undo but no redo; an
  accidental undo was unrecoverable. Added a redo stack that mirrors the existing
  undo snapshots: `doUndo` now pushes the current (post-action) mailbox onto redo
  before restoring, `doRedo` pops it back (pushing onto undo), and `apply` clears
  redo so any fresh action invalidates a stale redo branch — standard editor
  semantics. New `redo` shortcut (`⌘⇧Z`, rebindable, Global group) wired into the
  key engine + a palette command; `eventToKey` already produced `mod+shift+z` and
  `renderKeys` now prints `⌘/Ctrl+⇧z`. +1 test (now **390 passing**); build green.
- **Slice 42 (Send & Archive — reply and move on)** — Superhuman's core rhythm is
  answering a conversation and immediately clearing it. New pure
  `src/lib/sendActions.ts`: `isReplyDraft(draft)` (a reply carries both an
  `inReplyTo` and a `threadId`) and `postSendOutcome(draft, andArchive, {scheduled})`
  → `{archiveThreadId}`, which archives only a reply to an existing thread and
  never a brand-new message or a scheduled (Send Later) send. Wired: Compose now
  shows a **Send & Archive** button on replies (and a `⌘⇧↵` shortcut) calling a
  new `onSendArchive`; `queueSend` gained an `andArchive` flag that archives the
  conversation (independently undoable) right before the send toast, which reads
  "Sending & archived — undo send…". A new opt-in **setting** ("After sending a
  reply, archive the conversation") makes the plain Send / `⌘↵` do it for every
  reply. +5 tests (now **389 passing**); build green.
- **Slice 41 (Manual VIPs — user-controlled importance)** — the Focus view and
  the sender card already guess who matters from the contact graph (frequency +
  starred), but "important" is personal. New pure `src/lib/vips.ts`: a persisted
  `email -> boolean` override map (true = forced VIP, false = forced not-VIP)
  with `isVip` (blends an override with the heuristic), `setVip`/`clearVip`/
  `toggleVip` (immutable, same-ref on no-op, casing-normalized), `vipEmailSet`
  (applies every override on top of the heuristic set → the address set the
  Focus priority engine consumes), `manualVipCount` and a defensive
  `sanitizeVips`. Wired: the reader's **sender card** and the **People profile**
  both show a ★/☆ **VIP toggle** (pin or demote a correspondent) reading/writing
  the one map so they stay in sync, the People master-list badge reflects the
  effective status, the App's `vipEmails` memo now merges heuristic + overrides
  (so Focus re-ranks immediately and the badge follows), and it's persisted
  (`vips`) + cleared on reset. +9 tests (8 lib + 1 persistence; now **384
  passing**); build green.
- **Slice 40 (Reader conversation depth — expand / collapse all)** — Gmail and
  Superhuman open a thread with only the latest message expanded and the rest
  collapsed to one-line headers, then let you open the whole conversation at
  once. New pure `src/lib/conversationView.ts` manages the expand state as an
  immutable `Set<string>` of message ids: `defaultExpanded` (latest only),
  `toggleExpanded`, `expandAll`, `collapseToLatest`, `allExpanded`,
  `expandToggleLabel` and `collapsedCount`. `MessageItem` became a controlled
  component (expanded + onToggle props) so the reader owns the state; it resets
  to the default whenever the open thread (or its message set) changes. Added an
  **Expand-all / Collapse-all** control above multi-message conversations (shows
  "▸ Expand all · N collapsed" / "▾ Collapse all"), a new `o` shortcut (toggles
  in an open thread, opens the selected one from the list) and a palette command.
  +6 tests (now **375 passing**); build green.
- **Slice 39 (Trim quoted reply history — "show trimmed content")** — every
  reply most clients append the whole conversation underneath ("On Mon, Dana
  wrote: > …"); Superhuman and Gmail hide that wall of quoted text and show only
  what the sender wrote this time. New pure `src/lib/quotedText.ts`:
  `splitQuoted(body)` returns `{visible, quoted}` by finding where the quoted
  trail begins — a strict `^On … wrote:$` attribution, a run of `>`-prefixed
  lines (pulling an attribution line directly above them in), an Outlook
  `----- Original Message -----` / `----- Forwarded message -----` separator, or
  a `From:`-header block confirmed by a sibling `Sent:`/`To:`/`Subject:` line —
  while a casual "On Monday I'll send it" or "From: the whole team, thanks" is
  deliberately *not* treated as a quote. Plus `hasQuoted`, `quotedLineCount` (for
  the toggle label) and `isQuoteLine` (nested `>>` aware). Wired into the reader's
  `MessageItem`: it renders only the fresh content and, when there's history, a
  "••• Show trimmed content · N lines" toggle that reveals the quoted trail in a
  left-bordered block (a pure-forward message with no new text shows the quote
  inline). Seeded realistic quoted replies into the demo threads (Dana, Sam) so
  it's visible out of the box. +9 tests (now **369 passing**); build green.
- **Slice 38 (Focus view — priority attention ranking)** — Superhuman's core
  promise is spending less time in the inbox by surfacing what matters. New pure
  `src/lib/priority.ts`: `threadPriority(thread, vip, now)` returns a deterministic
  `{score, reasons}` from state + content signals — unread (+30), the ball is in
  your court / latest message inbound (+25), VIP sender (+25, from the contact
  graph's frequent/starred set), a direct ask (+15, "?" or "can you…/please/by
  EOD…"), pinned (+20), starred (+10), reminder set (+10), with bulk/newsletter
  penalized (−40) and a recency nudge — plus `isAttentionWorthy` (≥ a 40
  threshold), `rankByPriority` and `focusThreads` (filter + rank). Wired as a new
  **Focus** view (`⚡ Focus` sidebar item with a live count badge, `g f` chord,
  palette command): it reuses the inbox's visible set but keeps only the
  attention-worthy threads, ranked, each row tagged with its top driver (⚡ Unread
  / VIP sender / Direct ask…, full list on hover). Distinct from Split Inbox
  (categorization) — this is *ranking* of what to do next. Inbox-only chrome
  (split tabs, sweeps, AI banners) correctly stays hidden; hover quick-actions and
  triage work as in any list. +8 tests (now **360 passing**); build green.
- **Slice 37 (Row hover quick-actions)** — Superhuman reveals a triage toolbar
  when you hover a conversation row; SuperMail now does too, for mouse parity with
  the keyboard flow. New pure `src/lib/rowActions.ts`: `rowActions(rowState, view)`
  returns the contextual action set — Archive · Snooze · Delete · Read/Unread ·
  Pin/Unpin on normal rows (toggle verbs reflect the row's live state), and
  Restore / Not-spam / Delete-forever in the Trash and Spam folders — each as a
  `{id, label, icon}` descriptor. The App maps every id to the **same** handler
  the keyboard shortcut uses, so hover, keyboard and reader stay consistent. The
  toolbar floats over the date column on `:hover` / on the selected row; clicks
  `stopPropagation` so they never open the conversation. Snooze (which needs the
  time picker) selects the row and, if a *different* thread is open in the reader,
  closes it first so the picker can't target the wrong conversation. +6 tests
  (now **352 passing**); build green.
- **Slice 36 (Private notes about a person — contact-level notes)** — thread
  notes (slice 32) capture "this conversation"; this captures "this person". New
  pure `src/lib/contactNotes.ts`: an email-keyed `ContactNoteMap` with
  `normEmail` (so a contact is one note regardless of address casing across
  messages) and immutable `get/has/set/list/count` helpers — `setContactNote`
  trims, clears the key when empty, and returns the **same reference** on a no-op
  (clearing a missing note or setting identical text) so React doesn't churn —
  plus a defensive `sanitizeContactNotes` (normalizes keys, drops non-strings/
  empties). Persisted as `contactNotes` (mirrors thread `notes`), cleared on
  reset. Surfaced through a new shared **`ContactNoteField`** component used in
  **two** places that stay in sync: the reader's sender card ("🏷 Note about
  Dana" → click to edit, Esc/⌘↵ to finish, kept out of the global key engine)
  and the **People profile**, both reading/writing the one map. +8 tests (6 lib
  + 2 persistence; now **346 passing**); build green.
- **Slice 35 (Sender insight card — "social insights" in the reader)** —
  Superhuman shows a panel about the person you're emailing whenever you open a
  conversation. SuperMail now does too, and it cleans up scaffolding that had been
  imported-but-never-rendered. New pure `primaryCorrespondent(messages, selfEmail)`
  in `contacts.ts` picks "who this thread is with" — it counts each non-self
  participation (the sender on inbound messages, every recipient on outbound),
  returns the most-seen person (ties broken by recency), learns the longest name +
  any company/role across the thread, and returns null for a you-only thread. The
  reader renders a compact **`SenderCard`** under the subject: avatar, name, VIP
  badge, `role · company`, and your relationship history (received / sent / threads
  / last contact) pulled from the **account-scoped** contact graph via
  `contactStatsFor`, so the numbers always match the People view; identity falls
  back to the in-thread Contact for a brand-new sender ("First conversation"). Two
  quick actions — **✉ Email** (compose fresh) and **👤 History** (deep-links to
  the People view, now focused on that contact via a new optional `focusEmail`
  prop). Works in every conversation view incl. Trash/Spam. +4 tests (now **338
  passing**); build green.
- **Slice 34 (Manual "move to split")** — Superhuman lets you override the Split
  Inbox rules and drop a conversation into a specific lane. New `Email.splitOverride`
  (a split id, or null = follow rules); `matchSplit` now honors it **exclusively**
  (an assigned message appears only in its split and is pulled out of every lane
  it would otherwise match by rule); new pure `assignSplit(email, id|null)`
  (immutable, same-ref on no-op). Wired: a `v` shortcut, a reader **Move** button
  and a palette command open a split picker (the enabled splits + "↺ Auto (by
  rules)"); `moveToSplit` applies it to the whole thread as a single undoable
  step. The override rides on the persisted message, so it survives reloads and
  re-scopes with accounts. +3 tests (now **333 passing**); build green.
- **Slice 33 (Label management — create / rename / recolor / delete)** — labels
  were a static seed; now they're first-class. `labels.ts` gains pure helpers:
  `slugifyLabelId`, `isValidLabelName`, `findLabelByName`, `addLabel` (de-duped by
  case-insensitive name, returns `{labels, label}` for create-and-apply, with
  collision-safe ids), `renameLabel` / `recolorLabel` / `deleteLabel` (system
  labels protected), plus mailbox propagation — `renameLabelInEmails` and
  `removeLabelFromEmails` (emails store label *names*, so a rename/delete must
  sweep the mailbox). Labels are now stateful and persisted. Wired: a **Labels
  manager** in Settings (color swatch, rename in place, per-label usage count,
  delete, "+ Create label" with `/`-nesting) and **create-on-the-fly** in the
  `l` label menu (`LabelCreateRow` — type a name, Enter makes & applies it, single
  or bulk). Rename/delete also fix up the active sidebar filter and leave the
  label's view if it's open. +4 tests (now **330 passing**); build green.
- **Slice 32 (Private conversation notes)** — new pure `src/lib/notes.ts`: a
  `NoteMap` (threadId → text) with immutable, trimmed helpers — `getNote`,
  `hasNote` (whitespace-aware), `setNote` (clears the key when empty, returns the
  same reference when clearing a missing key so React doesn't churn),
  `notedThreadIds`, `noteCount`, and a defensive `sanitizeNotes` (string-only,
  non-empty) for load. Wired into the reader as a **NotePanel** under the AI
  summary: an "📝 Add note" affordance when empty, a click-to-edit card when a
  note exists, and an autofocusing textarea while editing (caret to end; Esc or
  ⌘/Ctrl+↵ finishes without leaking to the global key map). A new `n` shortcut
  (Triage group, rebindable) and a palette command open + focus the editor; a 📝
  badge marks noted conversations in the list. Local-only and never sent;
  persisted through the storage layer (`notes`) and cleared on reset. +7 tests
  (now **326 passing**); build green.
- **Slice 31 (Per-account identity — "From" + per-account signatures)** —
  completes the multi-account story. `accounts.ts` gains a per-account
  `signature?` field (an explicit `""` means "no signature for this account",
  `undefined` falls back to the global default) plus pure resolvers:
  `composeFromAccount(accounts, activeScope, replyAccountId?)` — picks the send
  identity with the priority **reply/forward thread's account → active single-
  account scope → primary** (never the "All" sentinel); `signatureFor`,
  `fromIdentity` ("Name <email>"), and `resolveAccounts` (merges persisted
  signature edits onto the static default set, ignoring stale ids). `signature.ts`
  gains `swapSignature(body, oldSig, newSig)` — swaps the *last* signature block
  in an in-progress draft so changing "From" mid-compose follows the new
  identity's sign-off while leaving a hand-edited block or the quoted reply
  thread untouched. Wired end-to-end: `Draft.fromAccountId`; a **"From" selector**
  in Compose (shown with >1 account) that live-swaps the signature; every compose
  entry point (new / reply / forward / availability) sets the from-account and
  its signature; sent mail (`outboxToEmail`) is attributed to that account so it
  lands in the right scope; a **per-account signature editor** in Settings →
  Account & identity; and `accounts` is now persisted. +14 tests (now **319
  passing**); build green.
- **Slice 30 (Themes 2.0 — appearance engine)** — new pure `src/lib/theme.ts`:
  a theme registry where each theme is a complete set of the nine CSS custom
  properties the app paints from, so the registry is the single source of truth
  for both the picker previews and the live app (no drift). Ships **8 themes** —
  5 dark (Midnight, Graphite, Ocean, Forest, Plum) + 3 light (Daylight, Paper,
  Arctic) — plus a 7-swatch **accent override** (`themeVars(themeId, accent)`
  recolors the primary actions without forking a theme), `getTheme` (safe
  fallback), `nextTheme` (cycle), `resolveAccent` and `themesByGroup`. The app
  now **writes the variables straight onto the document root** from the registry
  (replacing the old hand-written per-theme CSS), keeping `data-theme` /
  `data-theme-group` / `data-density` as CSS hooks. Settings gains an
  **Appearance** card: a visual theme swatch grid (live mini-preview of bg /
  panel / accent / text per theme, grouped Dark/Light), an accent-dot row, and
  density. Added a **"Cycle to the next theme"** + per-theme palette commands.
  `AppSettings.theme` widened to a theme id with a new `accent` field (persisted,
  back-compat defaults). +6 tests (now **311 passing**); build green.
- **Slice 29 (Customize keyboard shortcuts — remapping)** — new pure
  `src/lib/keymap.ts`: a sparse `Keymap` overlay (shortcut id → custom key
  tokens) with `effectiveShortcuts` (applies the overlay onto the registry
  without mutating it), `effectiveKeysFor`, `conflictFor` (no two actions can
  silently share a key), `setBinding` (drops the override when set back to
  default; `null` unbinds), `resetBinding` / `resetAll`, and `isRebindable`
  (chords and engine-critical keys — palette/escape/open/back/up/down/help — are
  locked). `shortcuts.ts`'s `resolveKey` and `shortcutsByGroup` now take an
  injectable registry, so the global key engine, the command-palette hints and
  the searchable shortcut reference all run off the user's **effective** keymap
  and can never drift. New **Settings → Keyboard shortcuts** card
  (`KeyboardSettings.tsx`): grouped rebindable actions, click-to-record a new key
  (focused capture input → `eventToKey`), inline conflict warning, per-row reset
  (↺) and unbind (✕), a "Reset all to defaults" button and a customized count;
  plus a palette command to reset. Persisted as `keymap` through the storage
  layer (sanitized as a plain object). +7 tests (now **305 passing**); build
  green.
- **Slice 28 (Multiple accounts / unified inbox)** — new pure
  `src/lib/accounts.ts`: an `Account` model (id/name/email/color), the
  `ALL_ACCOUNTS` unified sentinel, `filterByAccount` (untagged mail → primary),
  `accountIdOf`, `accountUnread` (unread *conversations* per account, reusing the
  real inbox-visibility rules), `accountById` / `isKnownAccount`,
  `accountInitials` and `accountScopeLabel`. `Email` gains an optional
  `accountId`; the seed mailbox is split across a **work** (Growthcab — the
  authorized account: Dana, Marcus, Priya, Sam, Renée, the pilot, repo +
  calendar) and a **personal** mailbox (newsletters, receipts, social). The app
  derives one account-scoped `scoped` set that feeds **every** view — inbox,
  splits, labels, saved searches, search, reminders, Stats, Sent & Seen, People,
  Attachments and Ask-AI all re-scope instantly when you switch — while triage,
  persistence and the background reminder/snooze timers keep operating on the
  full mailbox by id, so cross-account actions never break. Wired: a **sidebar
  account switcher** ("All inboxes" + one row per account, each with an avatar
  and its own unread-conversation badge counted from the whole mailbox), an
  always-visible **topbar scope pill** (one click returns to the unified inbox),
  palette **"Account: …"** commands, and a persisted active scope (`activeAccountId`,
  stale ids fall back to All). +6 tests (now **298 passing**); build green.
- **Slice 27 (Date detection — "we noticed a date")** — new pure
  `src/lib/dateMentions.ts`: `extractTimeMentions(text, now)` scans a message for
  time references ("circle back **Friday at 5pm**", "ready **in 3 days**", "reply
  **by 9:30am**", "**tomorrow morning**", "**end of day**", "**next week**") and
  resolves each through the existing `parseNaturalTime` engine — returning the
  soonest few distinct *future* instants with a human label and a ready-to-use
  `ms` offset. False-positive-disciplined: full weekday names match bare, but
  English-word-prone abbreviations ("sat"/"sun"/"wed"/"fri"…) only count when a
  clock time follows, so "I sat in the sun" never reads as a date. Surfaced as a
  compact reader banner under the AI summary — each detected time is a chip with
  one-click **⏰ Remind** and **💤 Snooze** that set a reminder / snooze for
  exactly that moment (reusing `doRemind` / `doSnooze`). Demonstrable on the seed
  mailbox (Dana→Monday, Marcus→tomorrow, Sam→Thursday, Renee→Friday). +9 tests
  (now **292 passing**); build green.
- **Slice 26 (Inbox-Zero sweeps + confirm guard)** — new pure `src/lib/bulk.ts`
  (`markAllReadPlan` / `archiveReadPlan` / `archiveAllPlan` → the exact thread-id
  set + count each sweep touches; pinned threads are never archived). Wired into
  two view/split/search-aware, single-undo actions: **Mark all as read** and
  **Archive all read** (clear the mail you've already seen). Both reachable from
  the command palette and from compact right-aligned **buttons on the split-tabs
  row** (shown only when there's something to do, with a live count). Also wired
  the previously-dead **`confirmArchiveAll`** setting: a reusable `confirmAction`
  shows a one-click **Confirm** toast (still undoable after) before the heavy
  sweeps — archive-all-read, **Empty Trash**, and bulk **Delete forever** — so
  the Settings toggle ("Confirm before bulk / archive-all actions") finally does
  what it says. +6 tests (now **283 passing**); build green.
- **Slice 25 (Auto-advance triage + email signatures)** — wired up two persisted
  settings that previously had **no effect**. (1) **Auto-advance**: new pure
  `src/lib/navigation.ts` (`nextAfterRemoval(ids, removedId)` → the id + post-
  removal index to focus next, preferring the row below, falling back to the row
  above, empty when the list clears). A stable `closeOrAdvance(threadId)` helper
  (reads the live thread list / open thread / preference from refs) replaces the
  old "close the reader" behavior in **all eight** triage paths (archive, trash,
  delete-forever, not-spam, mute, snooze, unsubscribe, spam): triaging the
  conversation you're reading now jumps straight to the next one — Superhuman's
  core "fly through the inbox" rhythm — and keeps the list cursor aligned; with
  the toggle off it just closes. Also centralized "landing on a conversation
  marks it read" into one effect (covers click / Enter / auto-advance) using a
  direct `setEmails` so it no longer pushes a "Marked read" entry onto the undo
  stack — `undo` now reverses the *triage*, not the incidental read. Added a
  palette command to toggle it. (2) **Signatures**: new pure
  `src/lib/signature.ts` (`signatureBlock` / `newComposeBody` /
  `quotedComposeBody`) inserts the Settings signature into new compose, replies
  and forwards (above the quoted text, with the RFC 3676 `-- ` delimiter); empty
  signature = none; AI-written drafts keep their voiced sign-off. Settings copy
  updated. +12 tests (now **277 passing**); build green.
- **Slice 24 (AI auto-organize — bulk auto-label)** — `ai.ts` gains
  `autoOrganizePlan(emails)` (for every non-archived/trashed inbox message, the
  suggested labels it doesn't already carry → `{changes, totalLabels, byLabel}`)
  and `organizeSummary` ("Finance ×3, Calendar ×2"). Wired into App as an
  `autoOrganize` action that applies the whole plan in one **undoable** step, an
  inbox banner ("✦ AI can label N messages (…) — Auto-organize"), and a palette
  command. Reuses the existing classifier, `applyLabel`, and undo stack. +3 tests
  (now **265 passing**); build green.
- **Slice 23 (AI: thread summaries + "Catch me up" digest)** — `ai.ts` gains
  `summarizeThread(messages)` — a real whole-conversation summary (an extractive
  gist across every message via a shared `topSentences` scorer, a header noting
  message/people counts, and the most recent open ask surfaced as "↪ Latest ask
  from …"), replacing the single-message summary in the reader, the `summarize`
  shortcut, and the palette command. Also `inboxDigest(emails)` + `formatDigest`:
  a "Catch me up" briefing — inbox/unread counts, what needs a reply, threads
  awaiting a reply from others (last message outbound), unread-Important count,
  newsletters to clear, and top senders. Wired through `askInbox` (a new
  catch-me-up / "what did I miss" intent returns the digest with clickable
  sources), surfaced as the first **Ask** suggestion and a **"Catch me up"**
  palette command that auto-runs in the Ask panel. +6 tests (now **262
  passing**); build green.
- **Slice 22 (Saved searches / smart views)** — New `src/lib/savedSearches.ts`:
  a named query (in the search.ts language) that runs across the whole mailbox
  (Trash excluded unless the query says `in:all`). Pure helpers — `createSavedSearch`
  (trims, defaults the name to the query), `addSavedSearch` (de-dupes by
  normalized query), remove/rename/`togglePinned`, `findByQuery`,
  `orderedSavedSearches` (pinned first, then oldest), `runSavedSearch`, and
  total/unread match counts. Three useful starter views ship by default (Unread,
  Has attachment, Last 7 days). New `"search"` view reuses the conversation list
  pipeline; a **Saved searches** sidebar section (icon, unread badge, hover-to-
  delete, click to open) with an inline “+ Save”; a search-context banner with a
  one-click **Save search**; and palette commands (“Save current search”, “Open
  saved search: …”). Persisted via the storage layer (`savedSearches`); leaving
  the search view clears the query so it doesn't bleed into folders. +13 tests
  (now **256 passing**); build green.
- **Slice 21 (Natural-language scheduling)** — New `src/lib/naturalTime.ts`: a
  deterministic free-text time parser powering Snooze, Remind Me, and Send Later.
  `parseNaturalTime(input, now)` understands offsets ("in 2 hours", "30m", "in 3
  days at 9am", "in 2 months"), day anchors ("tomorrow", "tomorrow evening",
  "this afternoon", "tonight", "end of day"), weekdays + abbreviations ("next tue
  9am", "fri 5pm"), "this/next weekend", "next week/month", and bare times ("2pm",
  "noon", "17:00") — bumping past times to the next valid day and stripping
  conversational lead-ins ("remind me…"). Clock-anchored phrases resolve in local
  time; pure offsets are timezone-independent; everything is anchored to an
  injected `now` for testability. Also replaced the old rough `ms`-offset presets
  with **smart presets** that compute exact clock times ("Tomorrow" = tomorrow
  8am, not now+24h), each rendering its resolved time. New reusable
  `TimePicker` / `RemindPicker` components (preset buttons + a live-preview
  free-text field) wired into the snooze & remind menus and the compose
  send-later menu. +32 tests (now **243 passing**); build green.
- **Slice 20 (Attachments hub)** — New `src/lib/attachments.ts`: `collectAttachments`
  flattens every file across the mailbox (newest-first, trashed excluded by
  default) with type inference (`attachmentKind` maps ~40 extensions to pdf /
  image / doc / sheet / slide / design / archive / code / calendar / other),
  `filterAttachments` (free text + `kind:`/`type:` operator), and
  `attachmentBreakdown` for per-kind counts. New **Attachments** view (`g a`):
  search box, type filter chips with counts and icons, and a file list that opens
  the containing thread on click. Enriched the mock mailbox with varied file
  types (pdf/xlsx/png/pptx/docx/fig). +5 tests (now **211 passing**); build green.
- **Slice 19 (Inbox health & productivity stats)** — New `src/lib/stats.ts`:
  `computeStats` derives a deterministic snapshot from the live mailbox (inbox /
  unread / needs-reply / awaiting-reply / reminders-due / snoozed / scheduled /
  starred / spam / trash counts, cleared %, open-rate) plus a 0–100 **inbox-health
  score** and an inbox-zero flag; `nextActions` turns that into a prioritized
  "what to do next" list. New **Stats** view (health card, cleared-progress bar,
  clickable next-actions that route to the right view, a 10-tile grid, and an
  inbox-zero celebration), a sidebar item, and a palette command. Also added an
  exported `needsReplyCandidates` AI helper, and fixed the test email factory to
  carry the new `trashed`/`muted`/`pinned` fields. +6 tests (now **206 passing**);
  build green.
- **Slice 18 (AI rewrite / tone-shift)** — `ai.ts` gains `rephrase(text, mode)`
  with five deterministic modes (`shorter`, `longer`, `formal`, `casual`,
  `polish`) and a `REWRITE_MODES` registry: formal expands contractions + lifts
  casual words, casual re-contracts + warms greetings, shorter strips filler and
  caps at two sentences/paragraph, longer appends a tone-aware courteous close
  (idempotent), polish fixes capitalization/spacing/terminal punctuation while
  preserving newlines. Wired into Compose as a **"Rewrite ▾"** menu that rewrites
  the current draft in place. +7 tests (now **200 passing**); build green.
- **Slice 17 (Drafts folder)** — "Save draft" now persists locally (upsert by id)
  and survives reloads, instead of being discarded. New **Drafts** view (subject /
  recipient / preview, reply & scheduled pills, Edit-in-place, Discard), a sidebar
  item with a count badge, a `g d` chord + palette command, and send/schedule
  removes the draft from the folder. Drafts added to the versioned persistence
  layer (`PersistedState.drafts` + `sanitize`) and cleared on reset. Copy made
  honest: drafts are local & always reviewed by the human before a manual Gmail
  send — sending stays disabled. +1 test (now **193 passing**); build green.
- **Slice 16 (Snippets 2.0 — variables)** — New `src/lib/snippets.ts`: a pure
  text-expansion engine matching Superhuman's "Compose Quickly". `expandSnippet`
  fills `{{first_name}}` / `{{last_name}}` / `{{full_name}}` / `{{email}}` (derived
  from the recipient or an explicit name), `{{my_name}}` / `{{my_first_name}}`,
  and UTC-deterministic `{{date}}` / `{{day}}` / `{{time}}`, and reports the
  `{{cursor}}` offset so the caret lands where you want. `matchSnippetAt` /
  `expandAtCaret` do longest-shortcut matching at the caret (so `;fuller` beats
  `;fu`) and rewrite only the text before the caret. Compose now expands inline as
  you type and re-positions the caret (`useLayoutEffect`), the snippet chips fill
  every variable, the seed snippets showcase them, and Settings lists the
  available tokens. +9 tests (now **192 passing**); build green.
- **Slice 15 (Trash · Spam · Mute · Pin)** — First-class Gmail folders and
  conversation states. `mailbox.ts` gains an `isSpam` helper and a rewritten
  `visibleForView` so **Trash** (`trashed`) and **Spam** (local `Spam` label) are
  their own folders and trashed mail is excluded from every other view (Gmail
  behavior); inbox now also hides muted threads. New Email fields `trashed`/
  `trashedAt`/`muted`/`pinned`; `threads.ts` surfaces `pinned`/`muted` and floats
  **pinned** conversations to the top. New keyboard triage: `#` delete→Trash,
  `!` mark spam, `m` mute, `p` pin, `⇧U` mark-unread — the key normalizer
  (`eventToKey`) now understands Shift+letter while keeping `!`/`#`/`?` literal.
  Wired end-to-end: sidebar **Trash**/**Spam** views with context actions
  (Restore, Delete-forever, Empty Trash, Not-spam), reader Delete/Mute/Pin
  buttons, bulk Delete / Restore / Delete-forever, row pin/mute badges, and six
  palette commands. +8 tests (now **183 passing**); build green.
- **Slice 14 (People / contacts)** — New `src/lib/contacts.ts`: builds a contact
  graph from the mailbox — for each message the "other party" (sender on inbound,
  recipients on outbound) is aggregated into received/sent/thread/unread counts,
  last-interaction time, learned company/role, and a VIP heuristic (frequency or
  starred); plus search, four sorts, a participant lookup, and avatar/initials
  helpers. New **People** view (searchable, sortable master list with avatars +
  VIP badges + unread counts, and a detail card with stats, recent conversations,
  and a one-click Compose), a nav item and a palette command. +7 tests (now
  **172 passing**).
- **Slice 13 (read-status feed — "Sent & Seen")** — New `src/lib/readStatus.ts`
  mirroring the live `get_read_status_feed`: `buildReadEvents` derives one event
  per opened outbound message (who/when/device, newest first) from the mailbox's
  real `openedByRecipientAt` data (device synthesized deterministically and
  labeled as illustrative — Gmail can't report opens); `readStatusFeed` applies a
  `since` window (default 24h), `limit` (≤200), thread filter and an opaque
  pagination cursor; `readStatusSummary` gives sent/opened/open-rate/awaiting-reply.
  New **Sent & Seen** view (summary stats, last-24h/7d/30d window, per-open rows
  with a device icon and a one-click **Follow up** on "opened, no reply"), a nav
  item with an "awaiting reply" badge, and a palette command. Seeded three sent
  mock messages with real open receipts. +9 tests (now **165 passing**).
- **Slice 12 (AI personalization — "learns your voice")** — New
  `src/lib/personalization.ts`: a voice profile (greeting style, sign-off, tone,
  verbosity, personal facts) plus `updatePersonalization`, a deterministic
  natural-language feedback parser matching the live `update_personalization`
  tool ("I prefer casual greetings like Hey", "sign off with Cheers", "I like
  shorter emails", "my title is now VP") that returns the updated profile and a
  list of changes, never silently dropping feedback. `greeting` / `signatureLines`
  / `composeBody` apply the profile, and `ai.ts`'s `writeWithAi`, `draftReply`,
  `instantReplies` and `followUpDraft` now write in the user's voice (tone-aware
  lead-ins/closers, verbosity-scaled length) — backward-compatible via an optional
  param so existing output is unchanged by default. Wired end-to-end: Compose's
  "write with AI", the reader's instant replies + follow-up, the Reminders
  follow-up, a palette command, and a **"Your voice"** Settings card with a
  plain-English teach box, structured controls, and a remembered-facts list.
  Persisted `personalization` through storage. +12 tests (now **156 passing**).
- **Slice 11 (unsubscribe / block / spam)** — New `src/lib/unsubscribe.ts`: RFC 2369
  `List-Unsubscribe` header parsing (http + mailto, prefers a one-click https
  target), bulk/list-mail detection, a persisted sender/domain **block list**, and
  pure `unsubscribePlan` / `spamPlan` builders that describe the local outcome
  (archive + label + optional block/trash) and carry an explicit
  `contactsSender: false` safety invariant. **SuperMail never emails the sender or
  POSTs to a list endpoint** — it models the result locally and surfaces the parsed
  unsubscribe link read-only for the human. Wired into the reader (Unsubscribe +
  Spam buttons for bulk mail), an unsubscribe options menu (block sender / block
  domain / delete), a command-palette commands, an inbox "N from blocked senders →
  Archive all" banner, and a **block-list manager** in Settings (view / unblock).
  Seeded the bulk mock mail (HN, LinkedIn, X, Product Hunt) with realistic
  `List-Unsubscribe` headers; persisted `blocks` through the storage layer.
  +14 tests (now **144 passing**). `npm run build` green.
- **Slice 10 (calendar & scheduling)** — New `src/lib/calendar.ts`: a deterministic
  availability engine ("Find a time") that honors working hours, skips weekends,
  avoids existing events, and merges participant-busy intervals; UTC-stable slot/
  event formatting; a "Send availability" paste-ready text builder; immutable event
  creation; and a `MockCalendarProvider` mirroring `MailProvider` (live Google
  Calendar is a documented, write-disabled integration point). New `CalendarView`
  (upcoming events grouped by day + a "Find a time" tool with Hold/Insert), a `g c`
  go-to chord + palette commands ("Go to Calendar", "Insert availability", "Reply
  with my availability"), an **Insert availability** button in compose, and a
  **📅 Propose times** action in the conversation reader that replies with a
  greeting + your computed open slots. +16 tests (now **130 passing**).
  Safety: calendar *writes* never touch a real account — only the in-memory mock —
  and nothing here can send mail.
- **Slice 0** — Baseline audit. Existing app: mock mailbox, basic shortcuts, split tabs,
  snooze, command palette, compose+snippets, Gmail OAuth scaffold, AI placeholders. Tests + build green.
- **Slice 1** — Foundation libs: data-driven shortcut/command registry with `g`-chords;
  split-inbox rule engine + library; reminders/follow-up + send-later models; labels;
  unified MailProvider (mock + Gmail REST) with parity; expanded AI (ask-inbox, write,
  auto-label, auto-archive, follow-up). Unit tests for each.
- **Slice 2** — UI rebuild: dense layout, label/split sidebar, reminders & outbox views,
  onboarding tour, AI ask panel, undo, empty/loading/error states, hardened settings.
- **Slice 3 (safety)** — Hard-disabled email sending. New `src/lib/safety.ts` chokepoint
  (`assertNotSend`, `SendBlockedError`, `stripSendScopes`); `sendMessageRequest` and
  `GmailProvider.send` now throw before any network/token access; `users.messages.send` /
  `users.drafts.send` marked DISABLED in the endpoint map; OAuth no longer requests
  `gmail.send`. Proven by `safety.test.ts` (10 tests). Fixed PKCE under Node test envs
  with a portable pure-JS SHA-256 fallback + distinct state/nonce entropy.
- **Slice 4 (UI wired to the libs)** — Rebuilt `App.tsx` so the rich libraries are actually
  used end-to-end: data-driven shortcut registry with a working **g-chord engine**, fuzzy
  **command palette** with shortcut hints + recents, **split-inbox tabs** from the live engine
  with per-split unread counts + number-key jumps, nested **label sidebar** with counts,
  **Reminders** view (due/upcoming, remind-if-no-reply follow-up drafts), **Outbox** view with
  send-later + undo-send window (local sim), **Ask-your-inbox** panel with clickable sources,
  in-reader **summary / instant replies / suggested labels / auto-archive banner**, **undo
  stack** with toast, **onboarding tour** (persisted), and an upgraded **compose** (cc/bcc,
  contact autocomplete, snippets, write-with-AI, send-later, save-as-draft).
- **Slice 5 (tests)** — Added unit suites for the previously-untested core libs:
  `splitInbox`, `reminders`, `sendLater`, `labels`, `ai`, `provider`, and palette `fuzzyScore`.
  Suite grew from 25 → **83 passing tests**. `npm run build` (tsc + vite) green.
- **Slice 6 (persistence)** — New `src/lib/persistence.ts`: versioned, defensive
  localStorage layer (corrupt/old blobs ignored, never thrown) with an injectable
  KV store for tests. App now loads its working set on boot and saves on change
  (triage state, splits, snippets, outbox, settings, UI prefs). Added a "Reset
  mailbox" command and avoided per-second outbox writes. +8 tests.
- **Slice 7 (threading)** — Made the app conversation-centric. New
  `src/lib/threads.ts` groups messages into threads with aggregated summaries
  (participants, unread/starred/attachment, label union, latest). Mock mailbox now
  has real multi-message conversations (incl. outbound awaiting reply). The list
  shows one row per thread; the reader renders the full conversation with
  collapsible history and per-message read-receipt placeholders; all triage acts
  on the whole thread. Reminder "if no reply" now runs against real thread data.
  +6 tests (now **97 passing**).
- **Slice 8 (search)** — New `src/lib/search.ts`: a Gmail-style query language
  (`from:`, `to:`, `subject:`, `body:`, `label:`, `category:`, `is:`, `has:`,
  `in:`, `before:`/`after:`) with `-` negation, quoted phrases, relative dates
  (`7d`/`24h`/`2w`), and free-text AND. Wired into the search box with a
  click-to-insert operator popover; `toGmailQuery` maps the same parse to Gmail's
  `q` for the REST adapter. +12 tests (now **109 passing**).
- **Slice 9 (multi-select)** — New `src/lib/selection.ts` (toggle/range/select-all/
  prune set math). The list now has per-row checkboxes, `x` to select + advance,
  and shift-click range selection; a bulk action bar archives / marks read /
  stars / snoozes / labels the whole selection as a single undoable step.
  +5 tests (now **114 passing**).

## Known limitations / honest gaps

- Read-status on sent mail is a **placeholder**: Gmail's REST API does not expose open
  tracking; real receipts require a tracking pixel or a provider like Superhuman's own
  backend. SuperMail models the data shape and runs it in mock mode only. Documented as such.
- AI provider calls are wired but **not executed** in dev/CI to avoid requiring paid keys;
  a deterministic local fallback produces useful output offline and in tests.
- The Gmail client secret must live on a backend in a packaged app; the browser flow uses
  PKCE and treats the secret as optional for public clients.
- Calendar event **creation is mock-only by policy** (consistent with email sending being
  permanently disabled). The availability engine and "send availability" are fully usable;
  writing to a live Google Calendar is a documented, opt-in integration point
  (`get_availability` + `create_or_update_event` map directly to `CalendarProvider`) and is
  intentionally not wired in this build. Availability times are computed and labeled in **UTC**
  for deterministic behavior; a real integration would honor the user's IANA timezone.
