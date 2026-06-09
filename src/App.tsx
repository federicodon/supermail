import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BlockEntry, Contact, Draft, Email, Label, OutboxItem, Snippet, SplitInbox, View } from "./types";
import { freshMockEmails } from "./data/mockMailbox";
import { DEFAULT_SNIPPETS } from "./data/snippets";
import { freshMockCalendar } from "./data/mockCalendar";
import {
  type AppSettings,
  clearState,
  loadState,
  resolveSettings,
  saveState,
  serializeState,
  parseImportedState,
  mergeStates,
  STORAGE_VERSION,
} from "./lib/persistence";
import {
  applySnooze,
  isSnoozed,
  isSpam,
  visibleForView,
} from "./lib/mailbox";
import { searchQuery, SEARCH_OPERATORS } from "./lib/search";
import { buildGmailLiveSearch } from "./lib/gmailSearch";
import { toggleId, withRange, toggleAll, allSelected } from "./lib/selection";
import {
  DEFAULT_SPLITS,
  SPLIT_LIBRARY,
  activeSplits,
  assignSplit,
  matchSplit,
  splitUnreadCount,
} from "./lib/splitInbox";
import {
  DEFAULT_LABELS,
  labelTree,
  labelCount,
  applyLabel,
  removeLabel,
  addLabel,
  deleteLabel,
  recolorLabel,
  removeLabelFromEmails,
  renameLabel,
  renameLabelInEmails,
} from "./lib/labels";
import { groupThreads, threadById, participantsLabel, type Thread } from "./lib/threads";
import { nextAfterRemoval, neighborIndex } from "./lib/navigation";
import { newComposeBody, quotedComposeBody } from "./lib/signature";
import { type NoteMap, getNote, hasNote, sanitizeNotes, setNote } from "./lib/notes";
import { getContactNote, sanitizeContactNotes, setContactNote } from "./lib/contactNotes";
import { type VipMap, sanitizeVips, isVip, toggleVip, clearVip, vipEmailSet } from "./lib/vips";
import { ContactNoteField } from "./components/ContactNoteField";
import { rowActions, type RowActionId } from "./lib/rowActions";
import { messageActions, replyAllRecipients, messagePlainText, type MessageActionId } from "./lib/messageActions";
import { type ContactStats, buildContacts, contactStatsFor, primaryCorrespondent, initials as contactInitials, avatarColor } from "./lib/contacts";
import { focusThreads, isAttentionWorthy, threadPriority } from "./lib/priority";
import { markAllReadPlan, archiveReadPlan } from "./lib/bulk";
import { extractTimeMentions } from "./lib/dateMentions";
import { splitQuoted, quotedLineCount, quoteText } from "./lib/quotedText";
import { postSendOutcome } from "./lib/sendActions";
import {
  defaultExpanded,
  toggleExpanded,
  expandAll,
  collapseToLatest,
  allExpanded,
  collapsedCount,
} from "./lib/conversationView";
import {
  type CalendarEvent,
  type TimeSlot,
  createEvent,
  eventFromSlot,
  findAvailability,
  formatAvailabilityText,
  removeEvent,
} from "./lib/calendar";
import {
  HOLD_WINDOW_DAYS,
  buildHold,
  findHoldForThread,
  heldTimeText,
  holdSummary,
  proposeHoldSlot,
} from "./lib/holds";
import {
  clearReminder,
  reminderBuckets,
  reminderDue,
  reminderLabel,
  setReminder,
  armFollowUp,
  DEFAULT_FOLLOW_UP_MS,
} from "./lib/reminders";
import {
  cancel as cancelSend,
  canUndo,
  enqueue,
  pending,
  reschedule as rescheduleSend,
  sendLaterLabel,
  tickOutbox,
} from "./lib/sendLater";
import {
  eventToKey,
  renderKeys,
  resolveKey,
  type ChordState,
} from "./lib/shortcuts";
import {
  autoArchiveCandidates,
  autoOrganizePlan,
  organizeSummary,
  followUpDraft,
  instantReplies,
  suggestLabels,
  summarizeThread,
} from "./lib/ai";
import {
  addBlock,
  blockedEmails,
  isBulkMail,
  spamPlan,
  unsubscribePlan,
  unsubscribeTarget,
  type UnsubscribeOptions,
} from "./lib/unsubscribe";
import {
  resolvePersonalization,
  updatePersonalization,
  type Personalization,
} from "./lib/personalization";
import {
  FEED_WINDOWS,
  deviceIcon,
  getReadStatusFeed,
  readStatusSummary,
} from "./lib/readStatus";
import { computeStats, nextActions, type InboxStats } from "./lib/stats";
import { buildAgenda, agendaTodayCount, type AgendaItem } from "./lib/agenda";
import { type AgendaActionId } from "./lib/agendaActions";
import { TodayView } from "./components/TodayView";
import { neighborId, initialFocusId } from "./lib/messageNav";
import { replyTargetMessage, focusedOrLatest, selectionPreview, selectionWordCount } from "./lib/replyTarget";
import { meetingRequestInThread, meetingReasonText } from "./lib/meetingIntent";
import { extractActionItems, actionKindMeta } from "./lib/actionItems";
import { extractCommitments } from "./lib/commitments";
import {
  collectAttachments,
  filterAttachments,
  attachmentBreakdown,
  attachmentIcon,
  type AttachmentRef,
} from "./lib/attachments";
import {
  buildAuthUrl,
  buildTokenAuthUrl,
  createPkceSession,
  exchangeCodeForTokens,
  getProfileRequest,
  loadGmailConfig,
  verifyState,
  type GmailProfile,
  type TokenSet,
} from "./lib/gmail";
import { GmailProvider, MemoryTokenStore } from "./lib/provider";
import { gmailSyncSummary, mergeGmailLabels, mergeGmailSnapshot } from "./lib/gmailSync";
import {
  loadInitialLiveMailbox,
  connectLiveStream,
  fetchLocalSnapshot,
  postBridgeModify,
  type LiveSource,
  type LiveStream,
  type ModifyAction,
} from "./lib/liveBridge";
import { applyLiveSnapshot, upsertEmails, removeEmails, type LiveSnapshot } from "./lib/liveSync";
import { MessageBody } from "./components/MessageBody";
import {
  clearGmailPkceSession,
  clearGmailSession,
  loadGmailAccountEmail,
  loadGmailClientId,
  loadGmailPkceSession,
  loadGmailTokens,
  saveGmailAccountEmail,
  saveGmailClientId,
  saveGmailPkceSession,
  saveGmailTokens,
} from "./lib/gmailSession";
import { loadAiConfig } from "./lib/ai";
import {
  SNOOZE_SMART_PRESETS,
  REMIND_SMART_PRESETS,
  SEND_LATER_SMART_PRESETS,
} from "./lib/naturalTime";
import {
  DEFAULT_SAVED_SEARCHES,
  addSavedSearch,
  createSavedSearch,
  removeSavedSearch,
  orderedSavedSearches,
  savedSearchUnreadCount,
  findByQuery,
} from "./lib/savedSearches";
import {
  type Account,
  ALL_ACCOUNTS,
  accountById,
  accountIdOf,
  accountInitials,
  accountScopeLabel,
  accountUnread,
  composeFromAccount,
  filterByAccount,
  isKnownAccount,
  resolveAccounts,
  signatureFor,
} from "./lib/accounts";
import {
  type Keymap,
  effectiveKeysFor,
  effectiveShortcuts,
  resetAll as resetKeymap,
} from "./lib/keymap";
import { THEMES, getTheme, nextTheme, themeVars } from "./lib/theme";
import { CommandPalette, type Command } from "./components/CommandPalette";
import { ShortcutsGuide } from "./components/ShortcutsGuide";
import { Compose } from "./components/Compose";
import { Settings } from "./components/Settings";
import { AskPanel } from "./components/AskPanel";
import { Onboarding } from "./components/Onboarding";
import { CalendarView } from "./components/CalendarView";
import { PeopleView } from "./components/PeopleView";
import { TimePicker, RemindPicker } from "./components/TimePicker";

const ONBOARDING_KEY = "supermail.onboarded.v1";
const DEFAULT_TARGET_GMAIL = "federico.donatone@growthcab.com";

// UI-only pseudo split: the "All" tab unions every inbox category into one
// chronological list (Superhuman-style). NOT added to `splits` (no rules, never
// matched by matchSplit) — it only drives the tab UI + the list-filter bypass.
const ALL_SPLIT_ID = "all";
const ALL_SPLIT_TAB = { id: ALL_SPLIT_ID, name: "All", icon: "📥" } as const;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// The text the user currently has selected *inside the conversation reader*, or
// "" when nothing relevant is selected. Powers Superhuman-style "reply to your
// selection": pressing Reply quotes just the highlighted passage instead of the
// whole message. Containment-checked to the `.reader` pane so a selection in the
// composer, sidebar or a menu never leaks into a reply. DOM-reading (not pure),
// so it lives here rather than in a lib.
function readerSelection(): string {
  if (typeof window === "undefined") return "";
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return "";
  const text = sel.toString().trim();
  if (!text) return "";
  const node: Node | null = sel.anchorNode;
  const el = node instanceof Element ? node : node?.parentElement ?? null;
  if (!el || !el.closest(".reader")) return "";
  return text;
}

// Convert a just-sent outbox item into an outbound Email for the local store.
// The message is attributed to the account it was sent from so it lands in that
// account's scope (and its own "Sent" view) rather than always the primary.
function outboxToEmail(item: OutboxItem, accounts: Account[], self: { name: string; email: string }): Email {
  const d = item.draft;
  const acct = d.fromAccountId ? accountById(accounts, d.fromAccountId) : null;
  return {
    id: `sent-${item.id}`,
    threadId: d.threadId ?? `t-${item.id}`,
    accountId: acct?.id,
    // The sender is the chosen account, falling back to the user's own identity
    // from Settings (name + email) rather than a hardcoded placeholder.
    from: { name: acct?.name ?? self.name ?? "You", email: acct?.email ?? self.email },
    to: d.to ? [{ name: d.to, email: d.to }] : [],
    subject: d.subject || "(no subject)",
    preview: d.body.slice(0, 140),
    body: d.body,
    date: new Date().toISOString(),
    read: true,
    starred: false,
    archived: true, // sent items live outside the inbox
    category: "other",
    labels: ["SENT"],
    attachments: [],
    snoozedUntil: null,
    reminderAt: null,
    openedByRecipientAt: null,
    outbound: true,
  };
}

export default function App() {
  // Load any locally-persisted working set once; fall back to fresh seed data.
  const persisted = useMemo(() => loadState(), []);
  const [emails, setEmails] = useState<Email[]>(() => persisted?.emails ?? freshMockEmails());
  const [outbox, setOutbox] = useState<OutboxItem[]>(() => persisted?.outbox ?? []);
  const [drafts, setDrafts] = useState<Draft[]>(() => persisted?.drafts ?? []);
  const [splits, setSplits] = useState<SplitInbox[]>(
    () => persisted?.splits ?? [...DEFAULT_SPLITS, ...SPLIT_LIBRARY]
  );
  const [labels, setLabels] = useState<Label[]>(() => persisted?.labels ?? DEFAULT_LABELS);
  const [blocks, setBlocks] = useState<BlockEntry[]>(() => persisted?.blocks ?? []);
  const [personalization, setPersonalization] = useState<Personalization>(
    () => resolvePersonalization(persisted?.personalization)
  );
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>(() => freshMockCalendar(Date.now()));
  const [settings, setSettings] = useState<AppSettings>(() => resolveSettings(persisted?.settings));
  // User keyboard remapping overlay (shortcut id -> custom keys). Empty = all
  // defaults. The effective registry below feeds the key engine, palette hints
  // and the shortcut reference so they can never drift.
  const [keymap, setKeymap] = useState<Keymap>(() => persisted?.keymap ?? {});
  const effShortcuts = useMemo(() => effectiveShortcuts(keymap), [keymap]);

  // Private per-conversation notes (threadId -> text), local only. `editingNote`
  // drives the reader's note editor (the `n` shortcut opens & focuses it).
  const [notes, setNotes] = useState<NoteMap>(() => sanitizeNotes(persisted?.notes));
  const [editingNote, setEditingNote] = useState(false);
  // Private per-person notes (normalized-email -> text), local only. Distinct
  // from thread notes — a note that follows the contact across conversations.
  const [contactNotes, setContactNotes] = useState<NoteMap>(() => sanitizeContactNotes(persisted?.contactNotes));

  // Manual VIP overrides (email -> forced on/off) layered on the heuristic.
  const [vips, setVips] = useState<VipMap>(() => sanitizeVips(persisted?.vips));

  // Connected accounts (multi-account / unified inbox). The account *set* is
  // static in this build — adding real accounts is an opt-in OAuth integration
  // point — but each account's signature is editable and persisted.
  const [accounts, setAccounts] = useState<Account[]>(() => resolveAccounts(persisted?.accounts));
  // The active account scope: ALL_ACCOUNTS ("all") for the unified inbox, or a
  // specific account id. Persisted; a stale id falls back to "all".
  const [activeAccountId, setActiveAccountId] = useState<string>(() => {
    const saved = persisted?.ui?.activeAccountId;
    return saved && isKnownAccount(accounts, saved) ? saved : ALL_ACCOUNTS;
  });

  const [view, setView] = useState<View>("inbox");
  const [activeSplitId, setActiveSplitId] = useState<string>(
    () => persisted?.ui?.activeSplitId ?? "important"
  );
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [selected, setSelected] = useState(0);
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [readerQuote, setReaderQuote] = useState<{ msgId: string; text: string } | null>(null);
  // Which messages in the open conversation are expanded (Gmail/Superhuman open
  // the thread with only the latest message expanded). Reset when the thread
  // changes; driven by the `o` shortcut + the reader's Expand/Collapse-all.
  const [expandedMsgs, setExpandedMsgs] = useState<Set<string>>(() => new Set());
  // The message focused for in-thread keyboard navigation (j/k move between
  // messages while a conversation is open). See src/lib/messageNav.ts.
  const [focusedMsgId, setFocusedMsgId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // When navigating to the People view from a sender card, the contact to focus.
  const [focusPerson, setFocusPerson] = useState<string | null>(null);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  // When set, the Ask panel auto-runs this question on open (e.g. "Catch me up").
  const [askInitial, setAskInitial] = useState<string | undefined>(undefined);
  const [searchHelp, setSearchHelp] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [menu, setMenu] = useState<null | "snooze" | "remind" | "label" | "unsub" | "move">(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [onboarding, setOnboarding] = useState(false);
  const [recentCmds, setRecentCmds] = useState<string[]>(() => persisted?.ui?.recentCmds ?? []);

  const [undo, setUndo] = useState<{ emails: Email[]; label: string }[]>([]);
  // Redo stack — actions popped by undo land here until a *new* action clears it.
  const [redo, setRedo] = useState<{ emails: Email[]; label: string }[]>([]);
  const [toast, setToast] = useState<{ msg: string; action?: { label: string; run: () => void } } | null>(null);

  const [snippets, setSnippets] = useState<Snippet[]>(() => persisted?.snippets ?? DEFAULT_SNIPPETS);
  const [savedSearches, setSavedSearches] = useState(
    () => persisted?.savedSearches ?? DEFAULT_SAVED_SEARCHES
  );
  // The saved search currently being viewed (drives sidebar highlight).
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const gmailEnv = useMemo(() => loadGmailConfig(), []);
  const [gmailClientId, setGmailClientId] = useState(() => loadGmailClientId(gmailEnv.clientId));
  const [gmailTokens, setGmailTokens] = useState<TokenSet | null>(() => loadGmailTokens());
  const [gmailConnectedEmail, setGmailConnectedEmail] = useState(() => loadGmailAccountEmail());
  const [gmailBusy, setGmailBusy] = useState(false);
  const [gmailNotice, setGmailNotice] = useState<string | null>(null);
  const gmailTargetEmail = gmailEnv.targetEmail || DEFAULT_TARGET_GMAIL;

  // ---- Live Gmail sync (always-on IMAP bridge / one-off snapshot) ----------
  // Real mail is mirrored in from the bridge (server/) in real time, or from a
  // captured snapshot when the bridge isn't running. See lib/liveBridge.ts.
  const [liveSource, setLiveSource] = useState<LiveSource | null>(null);
  const [liveAccount, setLiveAccount] = useState<string>("");
  const gmail = useMemo(
    () => ({
      ...gmailEnv,
      clientId: gmailClientId,
      enabled: gmailEnv.enabled || Boolean(gmailClientId),
    }),
    [gmailEnv, gmailClientId]
  );
  const gmailProvider = useMemo(() => {
    if (
      !gmail.enabled ||
      !gmail.clientId ||
      !gmailTokens ||
      gmailConnectedEmail.toLowerCase() !== gmailTargetEmail.toLowerCase()
    ) {
      return null;
    }
    return new GmailProvider(
      gmail,
      new MemoryTokenStore(gmailTokens, (tokens) => {
        saveGmailTokens(tokens);
        setGmailTokens(tokens);
      }),
      gmailTargetEmail
    );
  }, [gmail, gmailTokens, gmailConnectedEmail, gmailTargetEmail]);
  const ai = useMemo(() => loadAiConfig(), []);
  const now = Date.now();

  const emailsRef = useRef(emails);
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    emailsRef.current = emails;
  }, [emails]);
  // Mirror liveSource into a ref so fire-and-forget callbacks (bridge write-back,
  // real send) read the current source without being re-created.
  const liveSourceRef = useRef<LiveSource | null>(null);
  useEffect(() => {
    liveSourceRef.current = liveSource;
  }, [liveSource]);

  // Anchor index for shift-range multi-select.
  const anchorRef = useRef(0);

  // Persist the working set so a reload keeps triage state, splits, snippets,
  // outbox and settings (local-first; nothing leaves the device).
  useEffect(() => {
    saveState({ emails, splits, labels, outbox, drafts, snippets, savedSearches, blocks, accounts, personalization, settings, keymap, notes, contactNotes, vips, ui: { recentCmds, activeSplitId, activeAccountId } });
  }, [emails, splits, labels, outbox, drafts, snippets, savedSearches, blocks, accounts, personalization, settings, keymap, notes, contactNotes, vips, recentCmds, activeSplitId, activeAccountId]);

  // Paint the chosen theme: write its CSS variables straight onto the document
  // root (single source of truth = the theme registry), plus data-* attributes
  // for theme-group / density CSS hooks.
  useEffect(() => {
    const root = document.documentElement;
    const vars = themeVars(settings.theme, settings.accent);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.setAttribute("data-theme", settings.theme);
    root.setAttribute("data-theme-group", getTheme(settings.theme).group);
    root.setAttribute("data-density", settings.density);
  }, [settings.theme, settings.accent, settings.density]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = useCallback((msg: string, action?: { label: string; run: () => void }) => {
    setToast({ msg, action });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), action ? 6000 : 2200);
  }, []);

  // Run a destructive sweep now, or — when "Confirm before bulk actions" is on —
  // surface a one-click Confirm toast first. The action stays undoable either way.
  const confirmAction = useCallback(
    (message: string, run: () => void) => {
      if (settings.confirmArchiveAll) flash(message, { label: "Confirm", run });
      else run();
    },
    [settings.confirmArchiveAll, flash]
  );

  // Show onboarding once (persisted). Wrapped in try/catch for SSR/strict envs.
  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARDING_KEY)) setOnboarding(true);
    } catch {
      /* ignore */
    }
  }, []);
  const closeOnboarding = useCallback(() => {
    setOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  const fetchGmailProfile = useCallback(async (accessToken: string): Promise<GmailProfile> => {
    const req = getProfileRequest(accessToken);
    const res = await fetch(req.url, { method: req.method, headers: req.headers });
    if (!res.ok) throw new Error(`Gmail profile failed: ${res.status}`);
    return (await res.json()) as GmailProfile;
  }, []);

  const loadGmailInbox = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!gmailProvider) {
        if (!opts?.silent) flash("Connect Gmail first");
        return;
      }
      setGmailBusy(true);
      try {
        const [profile, live, gmailLabels] = await Promise.all([
          gmailProvider.profile().catch(() => null),
          gmailProvider.list({ q: "in:anywhere -in:spam -in:trash", maxResults: 250 }),
          gmailProvider.listLabels().catch(() => []),
        ]);
        const sync = mergeGmailSnapshot(emailsRef.current, live, "work");
        setEmails(sync.emails);
        if (gmailLabels.length) {
          setLabels((current) =>
            mergeGmailLabels(
              current,
              gmailLabels.map((label) => ({
                id: `gmail-${label.id}`,
                name: label.name,
                system: label.type === "system",
                color: label.color?.backgroundColor,
              }))
            )
          );
        }
        setActiveAccountId("work");
        setView("inbox");
        setOpenThreadId(null);
        setSelected(0);
        setQuery("");
        const history = profile?.historyId ? ` · history ${profile.historyId}` : "";
        const msg = `${gmailSyncSummary(sync.stats, gmailConnectedEmail)}${history}`;
        setGmailNotice(msg);
        if (!opts?.silent) flash(msg);
      } catch (err) {
        const msg = `Gmail load failed: ${errorMessage(err)}`;
        setGmailNotice(msg);
        flash(msg);
      } finally {
        setGmailBusy(false);
      }
    },
    [gmailProvider, gmailConnectedEmail, flash]
  );

  const connectGmail = useCallback(async () => {
    if (!gmail.clientId) {
      setView("settings");
      flash("Paste a Google OAuth Client ID first");
      return;
    }
    setGmailBusy(true);
    try {
      const pkce = await createPkceSession();
      saveGmailPkceSession(pkce);
      window.location.href =
        gmail.oauthFlow === "token"
          ? buildTokenAuthUrl(gmail, pkce.state)
          : buildAuthUrl(gmail, pkce.state, {
              challenge: pkce.challenge,
              nonce: pkce.nonce,
            });
    } catch (err) {
      const msg = `Could not start Gmail OAuth: ${errorMessage(err)}`;
      setGmailNotice(msg);
      flash(msg);
      setGmailBusy(false);
    }
  }, [gmail, flash]);

  const disconnectGmail = useCallback(() => {
    clearGmailSession();
    setGmailTokens(null);
    setGmailConnectedEmail("");
    setGmailNotice("Gmail disconnected from this browser session");
    setEmails(freshMockEmails());
    setActiveAccountId(ALL_ACCOUNTS);
    setView("settings");
    flash("Gmail disconnected");
  }, [flash]);

  const updateGmailClientId = useCallback(
    (clientId: string) => {
      saveGmailClientId(clientId);
      setGmailClientId(clientId.trim() || gmailEnv.clientId);
    },
    [gmailEnv.clientId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.pathname !== "/oauth2/callback") return;
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const code = url.searchParams.get("code");
    const accessToken = hashParams.get("access_token");
    const expiresIn = Number(hashParams.get("expires_in") ?? "3600");
    const gotState = url.searchParams.get("state") ?? hashParams.get("state");
    const err = url.searchParams.get("error") ?? hashParams.get("error");
    const errDescription = url.searchParams.get("error_description") ?? hashParams.get("error_description");
    const pkce = loadGmailPkceSession();

    const finish = (msg: string) => {
      setGmailNotice(msg);
      flash(msg);
      setView("settings");
      window.history.replaceState({}, "", "/");
    };

    if (err) {
      clearGmailPkceSession();
      finish(`Google OAuth failed: ${[err, errDescription].filter(Boolean).join(": ")}`);
      return;
    }
    if ((!code && !accessToken) || !pkce || !verifyState(pkce.state, gotState)) {
      clearGmailPkceSession();
      finish("Google OAuth failed: state mismatch or missing code/token");
      return;
    }

    setGmailBusy(true);
    void (async () => {
      try {
        const tokens = accessToken
          ? {
              accessToken,
              expiresAt: Date.now() + Math.max(60, Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
              scope: hashParams.get("scope") ?? undefined,
            }
          : await exchangeCodeForTokens(gmail, code!, pkce.verifier);
        const profile = await fetchGmailProfile(tokens.accessToken);
        if (profile.emailAddress.toLowerCase() !== gmailTargetEmail.toLowerCase()) {
          clearGmailSession();
          setGmailTokens(null);
          setGmailConnectedEmail("");
          finish(`Rejected ${profile.emailAddress}; authorize ${gmailTargetEmail} instead`);
          return;
        }
        clearGmailPkceSession();
        saveGmailTokens(tokens);
        saveGmailAccountEmail(profile.emailAddress);
        setGmailTokens(tokens);
        setGmailConnectedEmail(profile.emailAddress);
        setGmailNotice(`Connected Gmail: ${profile.emailAddress}`);
        flash(`Connected Gmail: ${profile.emailAddress}`);
        setView("settings");
        window.history.replaceState({}, "", "/");
      } catch (oauthErr) {
        clearGmailSession();
        finish(`Google OAuth failed: ${errorMessage(oauthErr)}`);
      } finally {
        setGmailBusy(false);
      }
    })();
  }, [fetchGmailProfile, flash, gmail, gmailTargetEmail]);

  useEffect(() => {
    if (gmailProvider) void loadGmailInbox({ silent: true });
  }, [gmailProvider, loadGmailInbox]);

  // Apply a full live snapshot: replace the mailbox with the real mirror (local
  // triage like snooze/reminder/pin is preserved by id), merge any Gmail labels.
  const applyLiveSnapshotState = useCallback((s: LiveSnapshot) => {
    setEmails((cur) => applyLiveSnapshot(cur, s.emails));
    if (s.labels?.length) {
      setLabels((current) =>
        mergeGmailLabels(
          current,
          s.labels!.map((l) => ({ id: l.id, name: l.name, system: !!l.system, color: l.color }))
        )
      );
    }
  }, []);

  // Connect the live Gmail mirror once on mount. Prefers the always-on bridge
  // (real-time SSE), falls back to a captured snapshot, else the bundled seed.
  useEffect(() => {
    let stream: LiveStream | null = null;
    let cancelled = false;
    void (async () => {
      const init = await loadInitialLiveMailbox();
      if (cancelled || !init) return;
      const { source, snapshot } = init;
      applyLiveSnapshotState(snapshot);
      setActiveAccountId(ALL_ACCOUNTS);
      setLiveSource(source);
      setLiveAccount(snapshot.account || "");
      if (source === "bridge") {
        flash(`⚡ Live sync · ${snapshot.account} · ${snapshot.emails.length} messages`);
        stream = connectLiveStream({
          onResync: (s) => applyLiveSnapshotState(s),
          onUpsert: (incoming) => setEmails((cur) => upsertEmails(cur, incoming)),
          onExpunge: (ids) => setEmails((cur) => removeEmails(cur, ids)),
          onHello: (info) => info.account && setLiveAccount(info.account),
        });
      } else {
        flash(`Loaded ${snapshot.emails.length} real messages from ${snapshot.account}`);
      }
    })();
    return () => {
      cancelled = true;
      stream?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // In snapshot mode (bridge not running), poll the snapshot file so refreshes
  // pushed by the session auto-refresh loop appear without a manual reload. The
  // bridge path doesn't need this — it streams over SSE.
  useEffect(() => {
    if (liveSource !== "snapshot") return;
    const id = window.setInterval(async () => {
      const snap = await fetchLocalSnapshot();
      if (snap?.emails?.length) setEmails((cur) => upsertEmails(cur, snap.emails));
    }, 45_000);
    return () => window.clearInterval(id);
  }, [liveSource]);

  // ---- Mutations with an undo / redo stack ----
  const doUndo = useCallback(() => {
    setUndo((u) => {
      if (!u.length) {
        flash("Nothing to undo");
        return u;
      }
      const last = u[u.length - 1];
      // Remember the current (post-action) state so it can be redone.
      setRedo((r) => [...r, { emails: emailsRef.current, label: last.label }].slice(-25));
      setEmails(last.emails);
      flash(`Undid: ${last.label}`);
      return u.slice(0, -1);
    });
  }, [flash]);

  const doRedo = useCallback(() => {
    setRedo((r) => {
      if (!r.length) {
        flash("Nothing to redo");
        return r;
      }
      const last = r[r.length - 1];
      setUndo((u) => [...u, { emails: emailsRef.current, label: last.label }].slice(-25));
      setEmails(last.emails);
      flash(`Redid: ${last.label}`);
      return r.slice(0, -1);
    });
  }, [flash]);

  const apply = useCallback(
    (label: string, updater: (prev: Email[]) => Email[], opts?: { silent?: boolean }) => {
      setUndo((u) => [...u, { emails: emailsRef.current, label }].slice(-25));
      setRedo([]); // a fresh action invalidates the redo stack
      setEmails(updater);
      if (!opts?.silent) flash(label, { label: "Undo", run: doUndo });
    },
    [flash, doUndo]
  );

  const mutate = useCallback(
    (label: string, id: string, patch: Partial<Email>) =>
      apply(label, (prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    [apply]
  );

  // Apply a patch to every message in a conversation, as one undoable action.
  const mutateThread = useCallback(
    (label: string, threadId: string, patch: Partial<Email>, opts?: { silent?: boolean }) =>
      apply(label, (prev) => prev.map((e) => (e.threadId === threadId ? { ...e, ...patch } : e)), opts),
    [apply]
  );

  // ---- Outbox ticking (undo window → real SMTP send when bridge is live) ----
  useEffect(() => {
    const t = setInterval(() => {
      setOutbox((prev) => {
        const { outbox: next, justSent } = tickOutbox(prev, Date.now());
        if (justSent.length) {
          const sentNow = Date.now();
          const isBridge = liveSourceRef.current === "bridge";
          if (isBridge) {
            // REAL send: each item has left the undo window → deliver it via the
            // bridge's SMTP endpoint. This is the SOLE outbound call in the app and
            // is reached only for items the user queued in Compose and did NOT
            // cancel in time. No agent/test path calls it.
            for (const it of justSent) {
              const d = it.draft;
              void fetch("/api/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: d.to,
                  cc: d.cc,
                  bcc: d.bcc,
                  subject: d.subject,
                  body: d.body,
                  inReplyTo: d.inReplyTo ?? undefined,
                  references: d.inReplyTo ?? undefined,
                }),
              })
                .then(async (r) => {
                  if (!r.ok) {
                    const { error } = await r.json().catch(() => ({ error: r.statusText }));
                    flash(`Send failed: ${error}`);
                  }
                })
                .catch((e) => flash(`Send failed: ${e?.message ?? "network error"}`));
            }
          }
          setEmails((es) => {
            const self = { name: settings.selfName, email: settings.selfEmail };
            // In bridge mode the real sent message arrives via SSE (Gmail id), so
            // don't add a local-sim copy (would duplicate). In mock/snapshot mode
            // keep the local simulation so the demo still works. Either way, arm
            // any "remind me if no reply" follow-ups now that replies have left.
            let merged: Email[] = isBridge
              ? es
              : [...justSent.map((it) => outboxToEmail(it, accounts, self)), ...es];
            for (const it of justSent) {
              const d = it.draft;
              if (d.followUpMs && d.threadId) {
                const arm = armFollowUp(merged, d.threadId, d.inReplyTo, d.followUpMs, sentNow);
                if (arm) {
                  merged = merged.map((e) =>
                    e.id === arm.anchorId
                      ? { ...e, reminderAt: arm.reminderAt, remindIfNoReply: true, reminderSetAt: arm.reminderSetAt }
                      : e
                  );
                }
              }
            }
            return merged;
          });
          flash(
            isBridge
              ? `Sent ${justSent.length} message${justSent.length > 1 ? "s" : ""} ✓`
              : `Sent ${justSent.length} message${justSent.length > 1 ? "s" : ""} (local sim)`
          );
          return next;
        }
        // Nothing became due — keep the same reference so we don't re-render or
        // re-persist every second.
        return prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [flash, accounts, settings.selfName, settings.selfEmail]);

  // ---- Derived data ----
  const enabledSplits = useMemo(() => activeSplits(splits), [splits]);
  const activeSplit = useMemo(
    () => enabledSplits.find((s) => s.id === activeSplitId) ?? null,
    [enabledSplits, activeSplitId]
  );

  // Account-scoped mailbox: every *view* derives from this so switching the
  // account (or "All inboxes") instantly re-scopes the whole app. Triage,
  // persistence and background timers keep working on the full `emails` set by
  // id, so cross-account actions and reminders never break.
  const scoped = useMemo(() => filterByAccount(emails, activeAccountId), [emails, activeAccountId]);

  const contacts = useMemo(() => {
    const set = new Set<string>();
    for (const e of scoped) {
      if (e.from.email && !e.outbound) set.add(`${e.from.name} <${e.from.email}>`);
    }
    return [...set];
  }, [scoped]);

  const baseList = useMemo(() => {
    if (view === "label" && activeLabel) {
      return scoped.filter((e) => e.labels.includes(activeLabel) && !e.archived && !e.trashed);
    }
    // Saved searches / global search run across the whole mailbox (Trash
    // excluded unless the query explicitly asks for in:all).
    if (view === "search") {
      return query.toLowerCase().includes("in:all") ? scoped : scoped.filter((e) => !e.trashed);
    }
    if (view === "reminders") return scoped.filter((e) => e.reminderAt && !e.trashed);
    // Focus reuses the inbox's visible set; the ranking/filtering happens at the
    // thread level (see `threads` below).
    if (view === "focus") return visibleForView(scoped, "inbox", now);
    // Views with bespoke renderers don't use the conversation list.
    if (
      view === "outbox" ||
      view === "calendar" ||
      view === "today" ||
      view === "readstatus" ||
      view === "people" ||
      view === "drafts" ||
      view === "stats" ||
      view === "attachments"
    )
      return [];
    return visibleForView(scoped, view, now);
  }, [scoped, view, activeLabel, query, now]);

  const list = useMemo(() => {
    let v = baseList;
    // The "All" pseudo-tab shows every inbox thread (no per-split filter).
    if (view === "inbox" && activeSplitId !== ALL_SPLIT_ID && activeSplit)
      v = v.filter((e) => matchSplit(e, activeSplit));
    return searchQuery(v, query, now);
  }, [baseList, view, activeSplit, activeSplitId, query, now]);

  // VIP correspondents — the frequent/starred heuristic, with the user's manual
  // VIP overrides layered on top (pin someone important, demote someone noisy).
  // Boosts their threads in Focus + drives the sender-card / People badge.
  const vipEmails = useMemo(() => {
    const heuristic = new Set<string>();
    for (const c of buildContacts(scoped, settings.selfEmail)) if (c.vip) heuristic.add(c.email.toLowerCase());
    return vipEmailSet(vips, heuristic);
  }, [scoped, settings.selfEmail, vips]);

  // Conversation-centric: the list shows one row per thread. The Focus view keeps
  // only the attention-worthy threads, ranked by priority.
  const threads = useMemo(() => {
    const grouped = groupThreads(list);
    return view === "focus" ? focusThreads(grouped, vipEmails, now) : grouped;
  }, [list, view, vipEmails, now]);

  // Count of attention-worthy inbox threads (drives the Focus sidebar badge),
  // computed independently of the current view.
  const focusCount = useMemo(
    () => groupThreads(visibleForView(scoped, "inbox", now)).filter((t) => isAttentionWorthy(t, vipEmails, now)).length,
    [scoped, vipEmails, now]
  );

  useEffect(() => {
    if (selected >= threads.length) setSelected(Math.max(0, threads.length - 1));
  }, [threads.length, selected]);

  const currentThread = threads[selected] ?? null;
  const current = currentThread?.latest ?? null; // representative message
  const openThread = openThreadId ? threadById(emails, openThreadId) : null;
  const openEmail = openThread?.latest ?? null;
  // Time references mentioned in the open conversation ("…Friday at 5pm…") →
  // one-click Remind / Snooze exactly then.
  const dateMentions = useMemo(
    () => (openEmail ? extractTimeMentions(`${openThread?.subject ?? ""}\n${openEmail.body}`, now) : []),
    [openEmail, openThread?.subject, now]
  );
  // Sender insight card: who the open conversation is with + your full
  // relationship history with them (Superhuman's "social insights" panel).
  const correspondent = useMemo<Contact | null>(
    () => (openThread ? primaryCorrespondent(openThread.messages, settings.selfEmail) : null),
    [openThread, settings.selfEmail]
  );
  const correspondentStats = useMemo<ContactStats | null>(
    () => (correspondent ? contactStatsFor(scoped, correspondent.email, settings.selfEmail) : null),
    [correspondent, scoped, settings.selfEmail]
  );
  // Scheduling intent: when the latest inbound message reads as a meeting
  // request, surface a one-click "Reply with my availability" in the reader.
  const meetingRequest = useMemo(
    () => (openThread && view !== "trash" && view !== "spam" ? meetingRequestInThread(openThread.messages) : null),
    [openThread, view]
  );
  // A tentative "hold" already placed for the open conversation, if any — drives
  // the meeting banner's hold/release toggle.
  const existingHold = useMemo(
    () => (openThreadId ? findHoldForThread(calEvents, openThreadId) : undefined),
    [calEvents, openThreadId]
  );
  // Action items: the concrete asks (deadlines / requests / direct questions)
  // the open conversation is making of you — Superhuman's "what is this email
  // asking me to do?" surface, deterministic & local.
  const actionItems = useMemo(
    () =>
      openThread && view !== "trash" && view !== "spam"
        ? extractActionItems(openThread.messages, settings.selfEmail)
        : [],
    [openThread, view, settings.selfEmail]
  );
  // Commitments: the promises *you* made in this conversation's outbound mail —
  // the mirror of action items, so you never drop the ball on something you
  // said you'd do.
  const commitments = useMemo(
    () =>
      openThread && view !== "trash" && view !== "spam"
        ? extractCommitments(openThread.messages, settings.selfEmail)
        : [],
    [openThread, view, settings.selfEmail]
  );
  const reminders = useMemo(() => reminderBuckets(scoped, now), [scoped, now]);
  const archiveSuggestions = useMemo(
    () => autoArchiveCandidates(visibleForView(scoped, "inbox", now)),
    [scoped, now]
  );
  // AI auto-organize: labels the inbox can gain from the classifier.
  const organizePlan = useMemo(
    () => autoOrganizePlan(visibleForView(scoped, "inbox", now)),
    [scoped, now]
  );
  // Inbox mail from senders the user has unsubscribed from / blocked.
  const blockedInbox = useMemo(
    () => blockedEmails(visibleForView(scoped, "inbox", now), blocks),
    [scoped, blocks, now]
  );
  // Read-status feed ("Sent & Seen") summary for the nav badge.
  const readSummary = useMemo(() => readStatusSummary(scoped), [scoped]);
  // Inbox-health / productivity snapshot for the Stats view.
  const stats = useMemo(() => computeStats(scoped, outbox, now), [scoped, outbox, now]);
  const eventsToday = useMemo(() => {
    const s = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
    const e = s + 86_400_000;
    return calEvents.filter((ev) => {
      const t = Date.parse(ev.start);
      return t >= s && t < e && Date.parse(ev.end) >= now;
    }).length;
  }, [calEvents, now]);

  // Unified "Today" agenda: calendar events + reminders/follow-ups + returning
  // snoozed mail + scheduled sends, on one timeline. Account-scoped (so it
  // follows the active inbox); the sidebar badge counts what lands today / is
  // already overdue.
  const agenda = useMemo(
    () => buildAgenda({ emails: scoped, events: calEvents, outbox }, now),
    [scoped, calEvents, outbox, now]
  );
  const agendaTodayBadge = useMemo(() => agendaTodayCount(agenda, now), [agenda, now]);

  // Live refs so the stable `closeOrAdvance` helper can read the current list,
  // the open conversation, and the auto-advance preference without being
  // re-created (and re-threaded through every triage callback's deps).
  const threadsRef = useRef(threads);
  const openThreadIdRef = useRef(openThreadId);
  const autoAdvanceRef = useRef(settings.autoAdvance);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);
  useEffect(() => {
    openThreadIdRef.current = openThreadId;
  }, [openThreadId]);
  useEffect(() => {
    autoAdvanceRef.current = settings.autoAdvance;
  }, [settings.autoAdvance]);

  // Landing on a conversation marks the whole thread read — whether it was
  // opened by a click, Enter, or an auto-advance jump. Done with a direct
  // `setEmails` (not the undoable `apply`) so it never pushes a "Marked read"
  // entry onto the undo stack: pressing undo still reverses the triage action,
  // not the incidental read. Returns the same array reference when there's
  // nothing to change, so it never causes a spurious re-render or re-persist.
  useEffect(() => {
    if (!openThreadId) return;
    setEmails((prev) =>
      prev.some((e) => e.threadId === openThreadId && !e.read)
        ? prev.map((e) => (e.threadId === openThreadId ? { ...e, read: true } : e))
        : prev
    );
  }, [openThreadId]);

  // Collapse the note editor whenever the open conversation changes.
  useEffect(() => {
    setEditingNote(false);
  }, [openThreadId]);

  // Reset the per-message expand state when the open conversation changes: open
  // with only the latest message expanded (Gmail/Superhuman). Keyed on the
  // thread's message-id signature so a new reply re-defaults sensibly.
  const openMsgIds = openThread ? openThread.messages.map((m) => m.id) : [];
  const openMsgKey = openMsgIds.join(",");
  const openMsgIdsRef = useRef<string[]>(openMsgIds);
  openMsgIdsRef.current = openMsgIds;
  const focusedMsgIdRef = useRef<string | null>(focusedMsgId);
  focusedMsgIdRef.current = focusedMsgId;
  useEffect(() => {
    const ids = openMsgKey ? openMsgKey.split(",") : [];
    setExpandedMsgs(defaultExpanded(ids));
    // In-thread nav starts on the latest message (the one expanded by default).
    setFocusedMsgId(initialFocusId(ids));
    setReaderQuote(null);
  }, [openThreadId, openMsgKey]);

  // Keep the keyboard-focused message scrolled into view as you j/k through it.
  useEffect(() => {
    if (!focusedMsgId) return;
    document.getElementById(`msg-${focusedMsgId}`)?.scrollIntoView({ block: "nearest" });
  }, [focusedMsgId]);

  // Move the in-thread focus one message down (+1) / up (-1), expanding the
  // newly focused message so its content is visible. No wrap at the edges.
  const moveMessageFocus = useCallback((dir: 1 | -1) => {
    const ids = openMsgIdsRef.current;
    const next = neighborId(ids, focusedMsgIdRef.current, dir);
    if (!next) return;
    setFocusedMsgId(next);
    setExpandedMsgs((prev) => (prev.has(next) ? prev : new Set(prev).add(next)));
  }, []);

  // Whole-thread expand / collapse toggle (the `o` shortcut + reader button).
  const toggleExpandAll = useCallback(() => {
    setExpandedMsgs((prev) =>
      allExpanded(prev, openMsgIdsRef.current)
        ? collapseToLatest(openMsgIdsRef.current)
        : expandAll(openMsgIdsRef.current)
    );
  }, []);

  // Save (or clear) the open conversation's private note.
  const saveNote = useCallback(
    (threadId: string, text: string) => setNotes((n) => setNote(n, threadId, text)),
    []
  );

  // Save (or clear) a private note kept about a person (keyed by their email).
  const saveContactNote = useCallback(
    (email: string, text: string) => setContactNotes((n) => setContactNote(n, email, text)),
    []
  );

  // Pin / unpin a correspondent as VIP. We pass the heuristic guess so toggling
  // always lands on the opposite of the *effective* status; flash the outcome.
  const toggleVipFor = useCallback(
    (email: string, name: string, heuristicVip: boolean) => {
      const nowVip = !isVip(vips, email, heuristicVip);
      setVips((m) => toggleVip(m, email, heuristicVip));
      flash(nowVip ? `★ ${name} is now a VIP — boosted in Focus` : `${name} removed from VIPs`);
    },
    [vips, flash]
  );

  // Clear a manual VIP override (back to the automatic guess) — used by the
  // VIP manager in Settings.
  const clearVipFor = useCallback((email: string) => {
    setVips((m) => clearVip(m, email));
  }, []);

  // The manual VIP overrides, resolved to display names, for the Settings VIP
  // manager: pinned VIPs first, then demoted, each alphabetical.
  const vipOverrides = useMemo(() => {
    const nameByEmail = new Map(
      buildContacts(scoped, settings.selfEmail).map((c) => [c.email.toLowerCase(), c.name] as const)
    );
    return Object.entries(vips)
      .map(([email, vip]) => ({ email, name: nameByEmail.get(email.toLowerCase()) || email, vip }))
      .sort((a, b) => Number(b.vip) - Number(a.vip) || a.name.localeCompare(b.name));
  }, [vips, scoped, settings.selfEmail]);

  // ---- Actions (conversation-level) ----
  const open = useCallback((thread: Thread) => {
    setOpenThreadId(thread.id); // the effect above marks it read
  }, []);

  // Flip to the previous / next conversation and open it (Shift+J / Shift+K) —
  // the Superhuman "fly through the inbox without leaving the reader" flow. We
  // anchor on the conversation being read (so it works mid-thread), else the
  // list cursor; the move clamps at the ends (no wrap). Distinct from j/k, which
  // move the row cursor in the list and step between messages inside a thread.
  const openNeighborThread = useCallback(
    (dir: 1 | -1) => {
      if (!threads.length) return;
      const anchor = openThreadId
        ? threads.findIndex((t) => t.id === openThreadId)
        : selected;
      const idx = neighborIndex(threads.length, anchor, dir);
      const next = threads[idx];
      if (!next) return;
      setSelected(idx);
      open(next);
    },
    [threads, openThreadId, selected, open]
  );

  // After a conversation is triaged out of the current list, decide what the
  // reader should do. If the triaged thread isn't the one being read, nothing
  // changes. Otherwise: with auto-advance on, jump straight to the next
  // conversation (Superhuman-style "fly through the inbox") and keep the list
  // cursor aligned; with it off, just close back to the list. Stable identity
  // (empty deps) — reads everything it needs from refs.
  const closeOrAdvance = useCallback((threadId: string) => {
    if (openThreadIdRef.current !== threadId) return;
    if (!autoAdvanceRef.current) {
      setOpenThreadId(null);
      return;
    }
    const { id, index } = nextAfterRemoval(
      threadsRef.current.map((t) => t.id),
      threadId
    );
    setOpenThreadId(id); // next conversation, or null if that was the last
    if (id) setSelected(index); // keep the list cursor on the advanced row
  }, []);

  const syncLiveThread = useCallback(
    (
      threadId: string,
      label: string,
      run: (provider: GmailProvider, message: Email) => Promise<void>
    ) => {
      if (!gmailProvider) return;
      const messages = emailsRef.current.filter((e) => e.threadId === threadId);
      if (!messages.length) return;
      void Promise.all(messages.map((m) => run(gmailProvider, m))).then(
        () => setGmailNotice(`${label} synced to Gmail`),
        (err) => {
          const msg = `${label} applied locally; Gmail sync failed: ${errorMessage(err)}`;
          setGmailNotice(msg);
          flash(msg);
        }
      );
    },
    [gmailProvider, flash]
  );

  // ALSO mirror triage back to Gmail through the live bridge (real IMAP), but
  // only in bridge mode. Fire-and-forget per message in the thread; never blocks
  // the optimistic local update and never throws.
  const syncBridgeThread = useCallback((threadId: string, action: ModifyAction) => {
    if (liveSourceRef.current !== "bridge") return;
    const messages = emailsRef.current.filter((e) => e.threadId === threadId);
    for (const m of messages) void postBridgeModify(m.id, action);
  }, []);

  const setThreadRead = useCallback(
    (threadId: string, read: boolean, label: string) => {
      mutateThread(label, threadId, { read });
      syncLiveThread(threadId, label, (provider, m) => provider.setRead(m.id, read));
      syncBridgeThread(threadId, read ? "read" : "unread");
    },
    [mutateThread, syncLiveThread, syncBridgeThread]
  );

  const setThreadStarred = useCallback(
    (threadId: string, starred: boolean) => {
      const label = starred ? "Starred" : "Unstarred";
      mutateThread(label, threadId, { starred });
      syncLiveThread(threadId, label, (provider, m) => provider.setStar(m.id, starred));
      syncBridgeThread(threadId, starred ? "star" : "unstar");
    },
    [mutateThread, syncLiveThread, syncBridgeThread]
  );

  const archive = useCallback(
    (threadId: string) => {
      mutateThread("Archived", threadId, { archived: true });
      syncLiveThread(threadId, "Archive", (provider, m) => provider.archive(m.id));
      syncBridgeThread(threadId, "archive");
      closeOrAdvance(threadId);
    },
    [mutateThread, syncLiveThread, syncBridgeThread, closeOrAdvance]
  );

  // Move a whole conversation to Trash (restorable). Undoable like any triage.
  const trashThread = useCallback(
    (threadId: string) => {
      mutateThread("Deleted", threadId, { trashed: true, trashedAt: new Date().toISOString() });
      syncLiveThread(threadId, "Delete", (provider, m) => provider.trash(m.id));
      syncBridgeThread(threadId, "trash");
      closeOrAdvance(threadId);
    },
    [mutateThread, syncLiveThread, syncBridgeThread, closeOrAdvance]
  );

  const restoreThread = useCallback(
    (threadId: string) => {
      mutateThread("Restored from Trash", threadId, { trashed: false, trashedAt: null });
    },
    [mutateThread]
  );

  // Permanently drop a thread from the local store (Trash → delete forever).
  const deleteForever = useCallback(
    (threadId: string) => {
      apply("Deleted forever", (prev) => prev.filter((e) => e.threadId !== threadId));
      closeOrAdvance(threadId);
    },
    [apply]
  );

  const emptyTrash = useCallback(() => {
    confirmAction("Empty Trash — remove every trashed conversation?", () => {
      apply("Emptied Trash", (prev) => prev.filter((e) => !e.trashed));
      setOpenThreadId(null);
    });
  }, [apply, confirmAction]);

  // Remove a thread from Spam: drop the local "Spam" label and un-archive.
  const notSpam = useCallback(
    (threadId: string) => {
      apply("Not spam", (prev) =>
        prev.map((e) =>
          e.threadId === threadId
            ? { ...removeLabel(e, "Spam"), archived: false }
            : e
        )
      );
      closeOrAdvance(threadId);
    },
    [apply]
  );

  // Mute (hide from inbox even on new mail) / pin (float to top) a conversation.
  const toggleMute = useCallback(
    (threadId: string) => {
      const muted = threadById(emailsRef.current, threadId)?.muted ?? false;
      mutateThread(muted ? "Unmuted" : "Muted", threadId, { muted: !muted });
      if (!muted) closeOrAdvance(threadId);
    },
    [mutateThread]
  );

  const togglePin = useCallback(
    (threadId: string) => {
      const pinned = threadById(emailsRef.current, threadId)?.pinned ?? false;
      mutateThread(pinned ? "Unpinned" : "Pinned", threadId, { pinned: !pinned });
    },
    [mutateThread]
  );

  const doSnooze = useCallback(
    (threadId: string, ms: number, label: string) => {
      apply(`Snoozed — ${label}`, (prev) =>
        prev.map((e) => (e.threadId === threadId ? applySnooze(e, ms, Date.now()) : e))
      );
      setMenu(null);
      closeOrAdvance(threadId);
    },
    [apply]
  );

  const doRemind = useCallback(
    (id: string, ms: number, label: string, ifNoReply: boolean) => {
      apply(`Reminder — ${label}`, (prev) =>
        prev.map((e) => (e.id === id ? setReminder(e, ms, Date.now(), ifNoReply) : e))
      );
      setMenu(null);
    },
    [apply]
  );

  const doLabel = useCallback(
    (threadId: string, name: string) => {
      const has = threadById(emailsRef.current, threadId)?.labels.includes(name) ?? false;
      apply(`Label · ${name}`, (prev) =>
        prev.map((e) => (e.threadId === threadId ? (has ? removeLabel(e, name) : applyLabel(e, name)) : e))
      );
    },
    [apply]
  );

  // Manually move a whole conversation into a Split Inbox lane (or back to "Auto"
  // = rule-based, with splitId null). Undoable; closes the menu.
  const moveToSplit = useCallback(
    (threadId: string, splitId: string | null, splitName: string) => {
      apply(splitId ? `Moved to ${splitName}` : "Moved to Auto", (prev) =>
        prev.map((e) => (e.threadId === threadId ? assignSplit(e, splitId) : e))
      );
      setMenu(null);
    },
    [apply]
  );

  // ---- Unsubscribe / block / spam (local-only; never contacts the sender) ----
  const doUnsubscribe = useCallback(
    (email: Email, opts: UnsubscribeOptions) => {
      const plan = unsubscribePlan(email, opts, new Date().toISOString());
      const tid = email.threadId;
      if (plan.block) setBlocks((b) => addBlock(b, plan.block!));
      apply(
        plan.trash ? "Unsubscribed & deleted" : "Unsubscribed",
        (prev) =>
          plan.trash
            ? prev.filter((e) => e.threadId !== tid)
            : prev.map((e) =>
                e.threadId === tid ? applyLabel({ ...e, archived: true }, plan.addLabel) : e
              ),
        { silent: true }
      );
      setMenu(null);
      setBulkMode(false);
      closeOrAdvance(tid);
      flash(
        `Unsubscribed from ${email.from.name} — ${plan.trash ? "deleted thread" : "archived"}${
          plan.block ? `, future mail auto-archives` : ""
        }. SuperMail did not email the sender.`,
        {
          label: "Undo",
          run: () => {
            doUndo();
            if (plan.block) setBlocks((b) => b.filter((x) => x.value !== plan.block!.value));
          },
        }
      );
    },
    [apply, flash, doUndo]
  );

  const doSpam = useCallback(
    (email: Email) => {
      const plan = spamPlan(email, new Date().toISOString());
      const tid = email.threadId;
      if (plan.block) setBlocks((b) => addBlock(b, plan.block!));
      apply(
        "Marked as spam",
        (prev) =>
          prev.map((e) =>
            e.threadId === tid ? applyLabel({ ...e, archived: true }, plan.addLabel) : e
          ),
        { silent: true }
      );
      closeOrAdvance(tid);
      flash(`Marked spam & blocked ${email.from.name} (local only — not reported)`, {
        label: "Undo",
        run: () => {
          doUndo();
          if (plan.block) setBlocks((b) => b.filter((x) => x.value !== plan.block!.value));
        },
      });
    },
    [apply, flash, doUndo]
  );

  const unblock = useCallback(
    (value: string) => setBlocks((b) => b.filter((x) => x.value !== value)),
    []
  );

  const archiveBlocked = useCallback(() => {
    const ids = new Set(blockedInbox.map((e) => e.id));
    if (!ids.size) return;
    apply(`Archived ${ids.size} from blocked senders`, (prev) =>
      prev.map((e) => (ids.has(e.id) ? { ...e, archived: true } : e))
    );
  }, [apply, blockedInbox]);

  // AI auto-organize: apply every suggested label across the inbox in one
  // undoable step (Superhuman-style "auto labels", in bulk).
  const autoOrganize = useCallback(() => {
    const plan = autoOrganizePlan(visibleForView(emailsRef.current, "inbox", Date.now()));
    if (!plan.totalLabels) {
      flash("Inbox already organized — no new labels to apply");
      return;
    }
    const add = new Map(plan.changes.map((c) => [c.id, c.add]));
    apply(
      `Organized ${plan.changes.length} message${plan.changes.length === 1 ? "" : "s"} — ${organizeSummary(plan)}`,
      (prev) =>
        prev.map((e) => {
          const labels = add.get(e.id);
          return labels ? labels.reduce((acc, l) => applyLabel(acc, l), e) : e;
        })
    );
  }, [apply, flash]);

  // Teach SuperMail the user's writing voice from natural-language feedback
  // (mirrors `update_personalization`). Deterministic + local.
  const onPersonalize = useCallback(
    (feedback: string) => {
      setPersonalization((p) => {
        const { profile, changes } = updatePersonalization(p, feedback);
        flash(
          changes.length
            ? `Learned: ${changes.map((c) => `${c.field} → ${c.to}`).join("; ")}`
            : "No changes detected from that feedback"
        );
        return profile;
      });
    },
    [flash]
  );

  // ---- Multi-select + bulk actions ----
  const clearSelection = useCallback(() => {
    setSelection(new Set());
    setBulkMode(false);
  }, []);

  // Apply a transform to every message in every selected thread, as one undo step.
  const bulkApply = useCallback(
    (label: string, transform: (e: Email) => Email, bridgeAction?: ModifyAction) => {
      if (!selection.size) return;
      const ids = [...selection];
      apply(`${label} ${selection.size}`, (prev) =>
        prev.map((e) => (selection.has(e.threadId) ? transform(e) : e))
      );
      // Mirror the bulk action back to Gmail too (bridge mode only, fire-and-forget).
      if (bridgeAction) for (const tid of ids) syncBridgeThread(tid, bridgeAction);
      setSelection(new Set());
      setBulkMode(false);
      setMenu(null);
    },
    [apply, selection, syncBridgeThread]
  );

  const bulkArchive = useCallback(() => bulkApply("Archived", (e) => ({ ...e, archived: true }), "archive"), [bulkApply]);
  const bulkRead = useCallback(() => bulkApply("Marked read", (e) => ({ ...e, read: true }), "read"), [bulkApply]);
  const bulkStar = useCallback(() => bulkApply("Starred", (e) => ({ ...e, starred: true }), "star"), [bulkApply]);
  const bulkTrash = useCallback(
    () => bulkApply("Deleted", (e) => ({ ...e, trashed: true, trashedAt: new Date().toISOString() }), "trash"),
    [bulkApply]
  );
  const bulkRestore = useCallback(
    () => bulkApply("Restored", (e) => ({ ...e, trashed: false, trashedAt: null })),
    [bulkApply]
  );
  const bulkDeleteForever = useCallback(() => {
    if (!selection.size) return;
    const n = selection.size;
    const ids = new Set(selection);
    confirmAction(`Permanently delete ${n} conversation${n > 1 ? "s" : ""}?`, () => {
      apply(`Deleted forever ${n}`, (prev) => prev.filter((e) => !ids.has(e.threadId)));
      setSelection(new Set());
      setBulkMode(false);
    });
  }, [apply, selection, confirmAction]);
  const bulkSnooze = useCallback(
    (ms: number, label: string) => bulkApply(`Snoozed — ${label} ·`, (e) => applySnooze(e, ms, Date.now())),
    [bulkApply]
  );
  const bulkLabel = useCallback(
    (name: string) => bulkApply(`Labeled ${name} ·`, (e) => applyLabel(e, name)),
    [bulkApply]
  );
  // Move every selected conversation into a Split Inbox lane at once (or back to
  // rule-based with splitId = null). Reuses the single-thread assignSplit.
  const bulkMove = useCallback(
    (splitId: string | null, splitName: string) =>
      bulkApply(`Moved to ${splitName} ·`, (e) => assignSplit(e, splitId)),
    [bulkApply]
  );
  const bulkUnread = useCallback(
    () => bulkApply("Marked unread", (e) => ({ ...e, read: false }), "unread"),
    [bulkApply]
  );
  // Remind every selected conversation at once. Unlike the other bulk actions a
  // reminder must land on *one* message per thread (the Reminders view lists
  // every message that carries one), so we target each thread's latest message
  // rather than every message via bulkApply.
  const bulkRemind = useCallback(
    (ms: number, label: string, ifNoReply: boolean) => {
      if (!selection.size) return;
      const now = Date.now();
      apply(`Reminder — ${label} · ${selection.size}`, (prev) => {
        const latest = new Map<string, { id: string; t: number }>();
        for (const e of prev) {
          if (!selection.has(e.threadId)) continue;
          const t = new Date(e.date).getTime();
          const cur = latest.get(e.threadId);
          if (!cur || t > cur.t) latest.set(e.threadId, { id: e.id, t });
        }
        const ids = new Set([...latest.values()].map((v) => v.id));
        return prev.map((e) => (ids.has(e.id) ? setReminder(e, ms, now, ifNoReply) : e));
      });
      setSelection(new Set());
      setBulkMode(false);
      setMenu(null);
    },
    [apply, selection]
  );

  // ---- Label management (create / rename / recolor / delete) ----
  // Create a label on the fly (de-duped) and immediately apply it — the Gmail/
  // Superhuman "type a new label, it's made and applied" flow. With no thread it
  // applies to the current bulk selection instead.
  const createLabelAndApply = useCallback(
    (name: string, threadId: string | null) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const { labels: next, label } = addLabel(labels, trimmed);
      setLabels(next);
      if (threadId) doLabel(threadId, label.name);
      else if (bulkMode) bulkLabel(label.name);
    },
    [labels, doLabel, bulkMode, bulkLabel]
  );

  // Create a label without applying it (Settings manager).
  const createLabel = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLabels((ls) => addLabel(ls, trimmed).labels);
  }, []);

  // Rename a label everywhere: the list + every message that carries its name +
  // the active sidebar filter, so nothing dangles on the old name.
  const renameLabelHandler = useCallback(
    (id: string, newName: string) => {
      const old = labels.find((l) => l.id === id);
      const name = newName.trim();
      if (!old || !name || name === old.name) return;
      setLabels((ls) => renameLabel(ls, id, name));
      setEmails((es) => renameLabelInEmails(es, old.name, name));
      setActiveLabel((cur) => (cur === old.name ? name : cur));
    },
    [labels]
  );

  const recolorLabelHandler = useCallback(
    (id: string, color: string) => setLabels((ls) => recolorLabel(ls, id, color)),
    []
  );

  // Delete a label: drop it from the list, strip it off every message, and leave
  // its sidebar view if it's open.
  const deleteLabelHandler = useCallback(
    (id: string) => {
      const target = labels.find((l) => l.id === id);
      if (!target) return;
      setLabels((ls) => deleteLabel(ls, id));
      setEmails((es) => removeLabelFromEmails(es, target.name));
      if (activeLabel === target.name) {
        setActiveLabel(null);
        if (viewRef.current === "label") setView("inbox");
      }
      flash(`Deleted label “${target.name}”`);
    },
    [labels, activeLabel, flash]
  );

  // ---- Inbox-Zero sweeps over the *current* list (view / split / search aware) ----
  const markAllRead = useCallback(() => {
    const { ids, count } = markAllReadPlan(threads);
    if (!count) {
      flash("Nothing unread here");
      return;
    }
    const set = new Set(ids);
    apply(`Marked ${count} read`, (prev) =>
      prev.map((e) => (set.has(e.threadId) ? { ...e, read: true } : e))
    );
  }, [threads, apply, flash]);

  const archiveAllRead = useCallback(() => {
    const { ids, count } = archiveReadPlan(threads);
    if (!count) {
      flash("No read conversations to clear");
      return;
    }
    const set = new Set(ids);
    confirmAction(`Archive ${count} read conversation${count > 1 ? "s" : ""}?`, () => {
      apply(`Archived ${count} read`, (prev) =>
        prev.map((e) => (set.has(e.threadId) ? { ...e, archived: true } : e))
      );
      setOpenThreadId(null);
    });
  }, [threads, apply, flash, confirmAction]);

  const toggleSelect = useCallback((threadId: string, idx: number) => {
    anchorRef.current = idx;
    setSelection((s) => toggleId(s, threadId));
  }, []);
  const rangeSelect = useCallback(
    (toIdx: number) => setSelection((s) => withRange(s, threads.map((t) => t.id), anchorRef.current, toIdx)),
    [threads]
  );
  const selectAllToggle = useCallback(
    () => setSelection((s) => toggleAll(threads.map((t) => t.id), s)),
    [threads]
  );

  const startCompose = useCallback(() => {
    const fromId = composeFromAccount(accounts, activeAccountId);
    setDraft({
      id: `d${Date.now()}`,
      to: "",
      subject: "",
      body: newComposeBody(signatureFor(accounts, fromId, settings.signature)),
      inReplyTo: null,
      fromAccountId: fromId,
    });
  }, [accounts, activeAccountId, settings.signature]);

  const composeTo = useCallback((toEmail: string) => {
    const fromId = composeFromAccount(accounts, activeAccountId);
    setDraft({
      id: `d${Date.now()}`,
      to: toEmail,
      subject: "",
      body: newComposeBody(signatureFor(accounts, fromId, settings.signature)),
      inReplyTo: null,
      fromAccountId: fromId,
    });
  }, [accounts, activeAccountId, settings.signature]);

  const startReply = useCallback((email: Email, body?: string, quoteSelection?: string) => {
    // Reply from the identity that owns the conversation (work thread → work
    // account), falling back to the active scope / primary.
    const fromId = composeFromAccount(accounts, activeAccountId, accountIdOf(email));
    // "Reply to your selection": when the user highlighted a passage in the
    // reader, quote exactly that; otherwise quote the message preview.
    const sel = (quoteSelection ?? "").trim();
    const quoted = sel ? quoteText(sel) : `> ${email.preview}`;
    setDraft({
      id: `d${Date.now()}`,
      to: email.from.email,
      subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      // An AI/availability-provided body is already voiced & signed — use it
      // verbatim. The default quoted reply gets the from-account's signature
      // inserted above the quote.
      body:
        body ??
        quotedComposeBody(
          `On ${new Date(email.date).toLocaleString()}, ${email.from.name} wrote:\n${quoted}`,
          signatureFor(accounts, fromId, settings.signature)
        ),
      inReplyTo: email.id,
      threadId: email.threadId,
      fromAccountId: fromId,
      // Pre-arm a no-reply follow-up when the user opted into that default.
      followUpMs: settings.autoFollowUp ? DEFAULT_FOLLOW_UP_MS : undefined,
    });
  }, [accounts, activeAccountId, settings.signature, settings.autoFollowUp]);

  // Reply-all to a specific message: To is the original sender, Cc is everyone
  // else who was on it (minus you). Unlike a plain Reply, this actually fills Cc
  // — the old reply-all path was a no-op alias for Reply.
  const startReplyAll = useCallback((email: Email) => {
    const fromId = composeFromAccount(accounts, activeAccountId, accountIdOf(email));
    const { to, cc } = replyAllRecipients(email, settings.selfEmail);
    setDraft({
      id: `d${Date.now()}`,
      to,
      cc: cc || undefined,
      subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      body: quotedComposeBody(
        `On ${new Date(email.date).toLocaleString()}, ${email.from.name} wrote:\n> ${email.preview}`,
        signatureFor(accounts, fromId, settings.signature)
      ),
      inReplyTo: email.id,
      threadId: email.threadId,
      fromAccountId: fromId,
      followUpMs: settings.autoFollowUp ? DEFAULT_FOLLOW_UP_MS : undefined,
    });
  }, [accounts, activeAccountId, settings.selfEmail, settings.signature, settings.autoFollowUp]);

  // Forward one specific message (its own subject + body), used by both the
  // keyboard `forward` action and the per-message Forward button.
  const forwardEmail = useCallback((e: Email) => {
    const fromId = composeFromAccount(accounts, activeAccountId, accountIdOf(e));
    setDraft({
      id: `d${Date.now()}`,
      to: "",
      subject: e.subject.startsWith("Fwd:") ? e.subject : `Fwd: ${e.subject}`,
      body: quotedComposeBody(
        `---------- Forwarded ----------\n${e.body}`,
        signatureFor(accounts, fromId, settings.signature)
      ),
      inReplyTo: null,
      fromAccountId: fromId,
    });
  }, [accounts, activeAccountId, settings.signature]);

  // Copy a single message's text to the clipboard (header + body). Local only —
  // never sends anything.
  const copyMessage = useCallback((m: Email) => {
    const text = messagePlainText(m);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => flash("Message copied to clipboard"),
        () => flash("Couldn't copy — clipboard blocked")
      );
    } else {
      flash("Clipboard unavailable in this browser");
    }
  }, [flash]);

  const updateReaderQuote = useCallback((msgId: string) => {
    const read = () => {
      const text = readerSelection();
      setReaderQuote(text ? { msgId, text } : null);
    };
    if (typeof window !== "undefined") window.requestAnimationFrame(read);
    else read();
  }, []);

  const clearReaderQuote = useCallback(() => {
    setReaderQuote(null);
    if (typeof window !== "undefined") window.getSelection()?.removeAllRanges();
  }, []);

  const replyToReaderQuote = useCallback((m: Email) => {
    const selectedText = readerQuote?.msgId === m.id ? readerQuote.text : readerSelection();
    startReply(m, undefined, selectedText);
    setReaderQuote(null);
    if (typeof window !== "undefined") window.getSelection()?.removeAllRanges();
  }, [readerQuote, startReply]);

  // Route a per-message action button to the right composer / clipboard handler.
  const onMessageAction = useCallback((id: MessageActionId, m: Email) => {
    switch (id) {
      case "reply": startReply(m, undefined, readerSelection()); break;
      case "reply-all": startReplyAll(m); break;
      case "forward": forwardEmail(m); break;
      case "copy": copyMessage(m); break;
    }
  }, [startReply, startReplyAll, forwardEmail, copyMessage]);

  const goView = useCallback((v: View) => {
    // Leaving a saved-search / global-search context clears the query so it
    // doesn't bleed into a normal folder view.
    if (viewRef.current === "search" && v !== "search") setQuery("");
    setView(v);
    setActiveSavedId(null);
    setOpenThreadId(null);
    setSelected(0);
    setActiveLabel(null);
    setSelection(new Set());
    setBulkMode(false);
  }, []);

  // Open the People view focused on a specific contact (from a sender card).
  const viewPerson = useCallback((email: string) => {
    setFocusPerson(email);
    goView("people");
  }, [goView]);

  // Switch the active account scope (or "All inboxes"). Clears the open thread /
  // selection so the cursor never points at a conversation from another account.
  const switchAccount = useCallback(
    (id: string) => {
      setActiveAccountId(id);
      setOpenThreadId(null);
      setSelected(0);
      setSelection(new Set());
      setBulkMode(false);
      if (viewRef.current === "search") {
        setQuery("");
        setActiveSavedId(null);
        setView("inbox");
      }
    },
    []
  );

  // Open a saved search / smart view in the global search view.
  const openSavedSearch = useCallback(
    (query: string, id: string | null) => {
      setQuery(query);
      setView("search");
      setActiveSavedId(id);
      setOpenThreadId(null);
      setSelected(0);
      setActiveLabel(null);
      setSelection(new Set());
      setBulkMode(false);
    },
    []
  );

  // Save the current query as a reusable saved search.
  const saveCurrentSearch = useCallback(() => {
    const q = query.trim();
    if (!q) {
      flash("Type a search first, then save it");
      return;
    }
    const existing = findByQuery(savedSearches, q);
    if (existing) {
      setActiveSavedId(existing.id);
      flash(`Already saved as “${existing.name}”`);
      return;
    }
    const name = (typeof window !== "undefined" ? window.prompt("Name this saved search", q) : q) ?? q;
    const s = createSavedSearch(name, q, new Date().toISOString());
    setSavedSearches((prev) => addSavedSearch(prev, s));
    setActiveSavedId(s.id);
    setView("search");
    flash(`Saved search “${s.name}”`);
  }, [query, savedSearches]);

  const searchGmailLive = useCallback(
    async (raw = query) => {
      if (!gmailProvider) {
        flash("Connect Gmail first");
        return;
      }
      const q = raw.trim();
      if (!q) {
        flash("Type a search first");
        return;
      }
      const liveSearch = buildGmailLiveSearch(q, Date.now());
      if (!liveSearch.q) {
        flash("That search is local-only; Gmail has no matching server operator");
        return;
      }
      setGmailBusy(true);
      try {
        const [live, gmailLabels] = await Promise.all([
          gmailProvider.list({ q: liveSearch.q, maxResults: 250 }),
          gmailProvider.listLabels().catch(() => []),
        ]);
        const sync = mergeGmailSnapshot(emailsRef.current, live, "work");
        setEmails(sync.emails);
        if (gmailLabels.length) {
          setLabels((current) =>
            mergeGmailLabels(
              current,
              gmailLabels.map((label) => ({
                id: `gmail-${label.id}`,
                name: label.name,
                system: label.type === "system",
                color: label.color?.backgroundColor,
              }))
            )
          );
        }
        setQuery(q);
        setView("search");
        setActiveSavedId(findByQuery(savedSearches, q)?.id ?? null);
        setActiveAccountId("work");
        setOpenThreadId(null);
        setSelected(0);
        setActiveLabel(null);
        const msg = `Live Gmail search · ${gmailSyncSummary(sync.stats, gmailConnectedEmail)}`;
        setGmailNotice(msg);
        flash(msg);
      } catch (err) {
        const msg = `Gmail search failed: ${errorMessage(err)}`;
        setGmailNotice(msg);
        flash(msg);
      } finally {
        setGmailBusy(false);
      }
    },
    [flash, gmailProvider, query, gmailConnectedEmail, savedSearches]
  );

  const deleteSavedSearch = useCallback(
    (id: string) => {
      setSavedSearches((prev) => removeSavedSearch(prev, id));
      setActiveSavedId((cur) => (cur === id ? null : cur));
    },
    []
  );

  // Send => enqueue through the outbox with an undo-send window (local sim).
  const queueSend = useCallback(
    (d: Draft, scheduledAt?: string, label?: string, andArchive?: boolean) => {
      const item = enqueue({ ...d, scheduledAt: scheduledAt ?? null }, Date.now(), settings.undoWindowMs);
      setOutbox((o) => [item, ...o]);
      // A queued draft leaves the Drafts view.
      setDrafts((prev) => prev.filter((x) => x.id !== d.id));
      setDraft(null);
      // "Send & Archive" (explicit, or the reply-and-move-on preference): archive
      // the conversation we just replied to. Done first so the send toast stays
      // the visible one; the archive remains independently undoable.
      const { archiveThreadId } = postSendOutcome(d, andArchive ?? false, { scheduled: Boolean(scheduledAt) });
      if (archiveThreadId) archive(archiveThreadId);
      const followUp = d.followUpMs && d.threadId ? " · follow-up armed" : "";
      if (scheduledAt) {
        flash(`Scheduled — ${label} (Outbox)${followUp}`);
      } else {
        flash(
          (archiveThreadId
            ? `Sending & archived — undo send within ${Math.round(settings.undoWindowMs / 1000)}s`
            : `Sending… undo within ${Math.round(settings.undoWindowMs / 1000)}s`) + followUp,
          {
            label: "Undo send",
            run: () => setOutbox((o) => cancelSend(o, item.id)),
          }
        );
      }
    },
    [flash, settings.undoWindowMs, archive]
  );

  // Persist a draft locally (upsert by id) so it survives reloads and is editable
  // from the Drafts view. When Gmail is connected this also creates a reviewable
  // Gmail draft; send endpoints remain blocked by the provider.
  const saveDraft = useCallback(
    (d: Draft) => {
      setDrafts((prev) =>
        prev.some((x) => x.id === d.id) ? prev.map((x) => (x.id === d.id ? d : x)) : [d, ...prev]
      );
      setDraft(null);
      if (!gmailProvider) {
        flash("Saved locally — review & send manually from Gmail");
        return;
      }
      void gmailProvider.createDraft(d, d.threadId ?? undefined).then(
        (res) => {
          const msg = `Created Gmail draft ${res.id} — review & send manually from Gmail`;
          setGmailNotice(msg);
          flash(msg);
        },
        (err) => {
          const msg = `Saved locally; Gmail draft failed: ${errorMessage(err)}`;
          setGmailNotice(msg);
          flash(msg);
        }
      );
    },
    [flash, gmailProvider]
  );

  const resumeDraft = useCallback((d: Draft) => setDraft({ ...d }), []);
  const deleteDraft = useCallback(
    (id: string) => setDrafts((prev) => prev.filter((x) => x.id !== id)),
    []
  );

  // Clear locally-persisted state and reload the seed mailbox.
  const resetMailbox = useCallback(() => {
    clearState();
    setEmails(freshMockEmails());
    setOutbox([]);
    setDrafts([]);
    setSplits([...DEFAULT_SPLITS, ...SPLIT_LIBRARY]);
    setLabels(DEFAULT_LABELS);
    setSnippets(DEFAULT_SNIPPETS);
    setBlocks([]);
    setAccounts(resolveAccounts());
    setNotes({});
    setContactNotes({});
    setVips({});
    setPersonalization(resolvePersonalization());
    setSettings(resolveSettings());
    setOpenThreadId(null);
    setSelected(0);
    flash("Mailbox reset to seed data");
  }, [flash]);

  // ---- Local data export / import (backup & migrate; local only) ----
  // Download the whole working set as JSON. Contains no credentials/tokens.
  const exportData = useCallback(() => {
    const json = serializeState({
      emails, splits, labels, outbox, drafts, snippets, savedSearches, blocks,
      accounts, personalization, settings, keymap, notes, contactNotes, vips,
      ui: { recentCmds, activeSplitId, activeAccountId },
    });
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `supermail-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash("Exported your SuperMail data");
    } catch {
      flash("Couldn't export — your browser blocked the download");
    }
  }, [emails, splits, labels, outbox, drafts, snippets, savedSearches, blocks, accounts, personalization, settings, keymap, notes, contactNotes, vips, recentCmds, activeSplitId, activeAccountId, flash]);

  // Validate an imported JSON backup, persist it, and reload to rehydrate the
  // whole app cleanly. "replace" overwrites the current state with the file;
  // "merge" combines them (the file wins on any per-item conflict, but nothing
  // current-only is lost) — useful for pulling a backup or another machine's
  // data in additively. The current state is read back from storage, which the
  // save effect keeps in sync with the live app.
  const importData = useCallback((json: string, mode: "replace" | "merge" = "replace") => {
    const parsed = parseImportedState(json);
    if (!parsed) {
      flash("Couldn't read that file — not a valid SuperMail backup");
      return;
    }
    const next =
      mode === "merge"
        ? mergeStates(loadState() ?? { version: STORAGE_VERSION }, parsed)
        : parsed;
    const { version: _v, savedAt: _s, ...rest } = next;
    if (!saveState(rest)) {
      flash("Import failed — couldn't write to local storage");
      return;
    }
    flash(mode === "merge" ? "Merged backup — reloading…" : "Imported — reloading…");
    setTimeout(() => window.location.reload(), 350);
  }, [flash]);

  const openById = useCallback(
    (id: string) => {
      const e = emails.find((m) => m.id === id);
      if (e) {
        goView(e.archived ? "archive" : "inbox");
        setOpenThreadId(e.threadId);
      }
    },
    [emails, goView]
  );

  // Route a click on a "Today" agenda row to the right place: a conversation
  // opens in the reader; an event jumps to the Calendar; a scheduled send jumps
  // to the Outbox (where it can be recalled).
  const openAgendaItem = useCallback(
    (item: AgendaItem) => {
      if (item.refKind === "thread") openById(item.refId);
      else if (item.refKind === "event") goView("calendar");
      else if (item.refKind === "outbox") goView("outbox");
    },
    [openById, goView]
  );

  // Quick-actions from the Today agenda — clear a reminder, return a snoozed
  // conversation to the inbox now, or cancel a scheduled send. Each routes to
  // the same primitive the Reminders / Snoozed / Outbox views use, so they're
  // single, undoable (or, for the send, cancelable) actions and never drift.
  const onAgendaAction = useCallback(
    (item: AgendaItem, action: AgendaActionId) => {
      if (action === "done") {
        mutate("Reminder done", item.refId, { reminderAt: null, remindIfNoReply: false });
      } else if (action === "unsnooze") {
        const e = emailsRef.current.find((m) => m.id === item.refId);
        if (e) mutateThread("Returned to inbox", e.threadId, { snoozedUntil: null });
      } else if (action === "cancelSend") {
        setOutbox((o) => cancelSend(o, item.refId));
        flash("Scheduled send canceled");
      }
    },
    [mutate, mutateThread, flash]
  );

  // ---- Calendar / scheduling (mock only; never writes a real calendar) ----
  const availabilityText = useCallback((durationMinutes = 30) => {
    const slots = findAvailability(calEvents, {
      start: new Date(Date.now()).toISOString(),
      end: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      durationMinutes,
      maxSlots: 5,
    });
    return formatAvailabilityText(slots, { tzLabel: "UTC" });
  }, [calEvents]);

  const composeWithBody = useCallback((body: string) => {
    setDraft({
      id: `d${Date.now()}`,
      to: "",
      subject: "Times to meet",
      body,
      inReplyTo: null,
      fromAccountId: composeFromAccount(accounts, activeAccountId),
    });
  }, [accounts, activeAccountId]);

  const holdSlot = useCallback(
    (slot: TimeSlot, title: string) => {
      setCalEvents((prev) => createEvent(prev, eventFromSlot(slot, title)).events);
      flash(`Held ${title === "Hold" ? "time" : title} on your calendar (mock)`);
    },
    [flash]
  );

  // Release any tentative hold by event id (used by the calendar + banner).
  const releaseHold = useCallback(
    (id: string) => {
      setCalEvents((prev) => removeEvent(prev, id));
      flash("Tentative hold released");
    },
    [flash]
  );

  // From the meeting banner: block (or release) a provisional slot for the open
  // conversation. Places the first open working-hours slot for the detected
  // meeting length, links it to the thread, and offers an undo. Mock-only.
  const toggleMeetingHold = useCallback(() => {
    if (!openThread || !meetingRequest) return;
    const tid = openThread.id;
    const existing = findHoldForThread(calEvents, tid);
    if (existing) {
      releaseHold(existing.id);
      return;
    }
    const slot = proposeHoldSlot(calEvents, {
      durationMinutes: meetingRequest.intent.durationMinutes,
      fromIso: new Date(Date.now()).toISOString(),
      days: HOLD_WINDOW_DAYS,
    });
    if (!slot) {
      flash(`No open slot in the next ${HOLD_WINDOW_DAYS} days to hold`);
      return;
    }
    const from = meetingRequest.message.from;
    const attendees = from?.email ? [from.email] : [];
    const payload = buildHold(slot, { threadId: tid, subject: openThread.subject, attendees });
    setCalEvents((prev) => createEvent(prev, payload).events);
    flash(`Tentative hold placed · ${holdSummary(slot)}`, {
      label: "Release",
      run: () =>
        setCalEvents((prev) => {
          const h = findHoldForThread(prev, tid);
          return h ? removeEvent(prev, h.id) : prev;
        }),
    });
  }, [openThread, meetingRequest, calEvents, releaseHold, flash]);

  // Reply to a thread with a greeting + your computed availability block. An
  // optional duration (from a detected meeting request) tailors the slot length.
  const replyWithTimes = useCallback(
    (e: Email, durationMinutes = 30) => {
      const name = e.from.name.split(" ")[0];
      startReply(e, `Hi ${name},\n\n${availabilityText(durationMinutes)}`);
    },
    [startReply, availabilityText]
  );

  // Once a slot is held, propose that exact time back to the requester — the
  // natural follow-up to a hold ("I've blocked Tue 9am; does that work?").
  const replyWithHeldTime = useCallback(() => {
    if (!meetingRequest || !existingHold) return;
    const name = meetingRequest.message.from.name.split(" ")[0];
    startReply(meetingRequest.message, `Hi ${name},\n\n${heldTimeText(existingHold, { tzLabel: "UTC" })}`);
  }, [meetingRequest, existingHold, startReply]);

  // ---- Shortcut action dispatch ----
  const runAction = useCallback(
    (id: string) => {
      switch (id) {
        case "down":
          // In a multi-message conversation, j moves between messages; in the
          // list it moves the row cursor.
          if (openThread && openThread.messages.length > 1) moveMessageFocus(1);
          else setSelected((s) => Math.min(s + 1, threads.length - 1));
          break;
        case "up":
          if (openThread && openThread.messages.length > 1) moveMessageFocus(-1);
          else setSelected((s) => Math.max(s - 1, 0));
          break;
        case "next-conversation":
          openNeighborThread(1);
          break;
        case "prev-conversation":
          openNeighborThread(-1);
          break;
        case "open":
          if (currentThread) open(currentThread);
          break;
        case "back":
          setOpenThreadId(null);
          break;
        case "search":
          (document.getElementById("search-input") as HTMLInputElement)?.focus();
          break;
        case "palette":
          setPaletteOpen((v) => !v);
          break;
        case "help":
          setShortcutsOpen(true);
          break;
        case "goto-focus":
          goView("focus");
          break;
        case "goto-inbox":
          goView("inbox");
          break;
        case "goto-today":
          goView("today");
          break;
        case "goto-starred":
          goView("starred");
          break;
        case "goto-snoozed":
          goView("snoozed");
          break;
        case "goto-reminders":
          goView("reminders");
          break;
        case "goto-drafts":
          goView("drafts");
          break;
        case "goto-archive":
          goView("archive");
          break;
        case "goto-outbox":
          goView("outbox");
          break;
        case "goto-calendar":
          goView("calendar");
          break;
        case "goto-people":
          goView("people");
          break;
        case "goto-attachments":
          goView("attachments");
          break;
        case "goto-readstatus":
          goView("readstatus");
          break;
        case "goto-settings":
          goView("settings");
          break;
        case "archive":
          if (currentThread) archive(currentThread.id);
          break;
        case "snooze":
          if (current || openEmail) setMenu("snooze");
          break;
        case "trash":
          if (currentThread) trashThread(currentThread.id);
          break;
        case "spam":
          if (openEmail || current) doSpam((openEmail ?? current)!);
          break;
        case "mute":
          if (currentThread) toggleMute(currentThread.id);
          break;
        case "pin":
          if (currentThread) togglePin(currentThread.id);
          break;
        case "note": {
          // Open the conversation (if needed) and focus its private note editor.
          const tgt = openThread ?? currentThread;
          if (tgt) {
            setOpenThreadId(tgt.id);
            setEditingNote(true);
          }
          break;
        }
        case "expand-all": {
          // In an open thread: toggle every message expanded/collapsed. From the
          // list: open the selected thread (a second press then expands all).
          if (openThread) toggleExpandAll();
          else if (currentThread) setOpenThreadId(currentThread.id);
          break;
        }
        case "star":
          if (currentThread) setThreadStarred(currentThread.id, !currentThread.starred);
          break;
        case "mark-read":
          if (currentThread) setThreadRead(currentThread.id, currentThread.hasUnread, currentThread.hasUnread ? "Marked read" : "Marked unread");
          break;
        case "mark-unread":
          if (currentThread) setThreadRead(currentThread.id, false, "Marked unread");
          break;
        case "label":
          if (current || openEmail) setMenu("label");
          break;
        case "move":
          if (current || openEmail) setMenu("move");
          break;
        case "remind":
          if (current || openEmail) setMenu("remind");
          break;
        case "select":
          if (currentThread) {
            anchorRef.current = selected;
            setSelection((s) => toggleId(s, currentThread.id));
            setSelected((s) => Math.min(s + 1, threads.length - 1));
          }
          break;
        case "auto-archive":
          if (currentThread) archive(currentThread.id);
          break;
        case "compose":
          startCompose();
          break;
        case "reply": {
          // Reply to the message the user is focused on in the thread (j/k),
          // falling back to the latest inbound message, then the selected row.
          const tgt = openThread
            ? replyTargetMessage(openThread.messages, focusedMsgIdRef.current)
            : current;
          if (tgt) startReply(tgt, undefined, readerSelection());
          break;
        }
        case "reply-all": {
          // Reply to everyone on the focused (or latest inbound) message — Cc
          // included, unlike a plain Reply.
          const tgt = openThread
            ? replyTargetMessage(openThread.messages, focusedMsgIdRef.current)
            : current;
          if (tgt) startReplyAll(tgt);
          break;
        }
        case "forward":
          if (openThread || current) {
            // Forward the focused message (you may forward your own), or the latest.
            const e = (openThread ? focusedOrLatest(openThread.messages, focusedMsgIdRef.current) : current)!;
            forwardEmail(e);
          }
          break;
        case "ai-write":
          startCompose();
          break;
        case "ask":
          setAskOpen(true);
          break;
        case "summarize":
          if (openThread || currentThread) flash(summarizeThread((openThread ?? currentThread)!.messages));
          break;
        case "undo":
          doUndo();
          break;
        case "redo":
          doRedo();
          break;
        case "escape":
          setOpenThreadId(null);
          setMenu(null);
          break;
        default:
          if (/^split-(\d)$/.test(id)) {
            if (view !== "inbox") break;
            const n = Number(id.split("-")[1]);
            if (n === 0) {
              setActiveSplitId(ALL_SPLIT_ID);
              setSelected(0);
              break;
            }
            const target = enabledSplits[n - 1];
            if (target) {
              setActiveSplitId(target.id);
              setSelected(0);
            }
          }
      }
    },
    [threads, threads.length, selected, currentThread, current, openEmail, openThread, open, openNeighborThread, archive, trashThread, doSpam, toggleMute, togglePin, setThreadRead, setThreadStarred, startCompose, startReply, startReplyAll, forwardEmail, goView, enabledSplits, view, doUndo, doRedo, toggleExpandAll, moveMessageFocus, flash, settings.signature, accounts, activeAccountId]
  );

  // ---- Global key handler with chord engine ----
  const chord = useRef<ChordState>({ pending: null, at: 0 });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable;
      const modalOpen = paletteOpen || shortcutsOpen || askOpen || !!draft || onboarding;

      // Command palette + Ask work everywhere (even over modals/inputs).
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAskOpen((v) => !v);
        return;
      }

      if (typing || modalOpen) {
        if (e.key === "Escape") {
          setShortcutsOpen(false);
          setMenu(null);
          (e.target as HTMLElement)?.blur?.();
        }
        return;
      }

      // Build a registry token (shift-aware) and resolve through the chord engine.
      const token = eventToKey(e);
      // Let unmodified single chars / known keys flow through resolveKey, using
      // the user's effective (remapped) registry.
      const { id, next } = resolveKey(token, chord.current, Date.now(), effShortcuts);
      chord.current = next;
      if (id) {
        e.preventDefault();
        runAction(id);
      } else if (next.pending) {
        // We started a chord (e.g. pressed "g"); swallow it.
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, shortcutsOpen, askOpen, draft, onboarding, runAction, effShortcuts]);

  const noteRecent = (id: string) => setRecentCmds((r) => [id, ...r.filter((x) => x !== id)].slice(0, 8));

  // ---- Command palette commands (derived, with shortcut hints) ----
  const commands: Command[] = useMemo(() => {
    const c = (id: string, label: string, run: () => void, opts?: Partial<Command>): Command => ({
      id,
      label,
      keys: effectiveKeysFor(opts?.id ?? id, keymap),
      run: () => {
        noteRecent(id);
        run();
      },
      ...opts,
    });
    return [
      c("compose", "Compose new email", startCompose, { group: "Compose" }),
      c("reply", "Reply to conversation", () => (openEmail ?? current) && startReply((openEmail ?? current)!), { group: "Compose", disabled: !(openEmail ?? current) }),
      c("ask", "Ask AI about your inbox", () => setAskOpen(true), { group: "AI" }),
      c("summarize", "Summarize conversation", () => (openThread ?? currentThread) && flash(summarizeThread((openThread ?? currentThread)!.messages)), { group: "AI", disabled: !(openEmail ?? current) }),
      c("catch-up", "Catch me up (inbox digest)", () => { setAskInitial("Catch me up"); setAskOpen(true); }, { group: "AI" }),
      c("auto-organize", "Auto-organize inbox (apply AI labels)", autoOrganize, { group: "AI" }),
      c("archive", "Archive conversation", () => currentThread && archive(currentThread.id), { group: "Triage", disabled: !currentThread }),
      c("trash", "Delete conversation (move to Trash)", () => currentThread && trashThread(currentThread.id), { group: "Triage", disabled: !currentThread }),
      c("mute", "Mute conversation", () => currentThread && toggleMute(currentThread.id), { group: "Triage", disabled: !currentThread }),
      c("pin", "Pin / unpin conversation", () => currentThread && togglePin(currentThread.id), { group: "Triage", disabled: !currentThread }),
      c("snooze", "Snooze conversation…", () => current && setMenu("snooze"), { group: "Triage", disabled: !current }),
      c("remind", "Remind me about conversation…", () => current && setMenu("remind"), { group: "Triage", disabled: !current }),
      c("label", "Label conversation…", () => current && setMenu("label"), { group: "Triage", disabled: !current }),
      c("move", "Move conversation to split…", () => (current || openEmail) && setMenu("move"), { group: "Triage", disabled: !(current || openEmail) }),
      c("note", "Add / edit private note on conversation", () => {
        const tgt = openThread ?? currentThread;
        if (tgt) { setOpenThreadId(tgt.id); setEditingNote(true); }
      }, { group: "Triage", disabled: !(openThread ?? currentThread) }),
      c("expand-all", "Expand / collapse all messages in conversation", () => {
        if (openThread) toggleExpandAll();
        else if (currentThread) setOpenThreadId(currentThread.id);
      }, { group: "Triage", disabled: !(openThread ?? currentThread) }),
      c("unsubscribe", "Unsubscribe from sender…", () => (openEmail ?? current) && setMenu("unsub"), { group: "Triage", disabled: !(openEmail ?? current) || !isBulkMail((openEmail ?? current)!) }),
      c("mark-spam", "Mark as spam & block sender", () => (openEmail ?? current) && doSpam((openEmail ?? current)!), { group: "Triage", disabled: !(openEmail ?? current) }),
      c("star", "Toggle star on conversation", () => currentThread && mutateThread(currentThread.starred ? "Unstarred" : "Starred", currentThread.id, { starred: !currentThread.starred }), { group: "Triage", disabled: !currentThread }),
      c("mark-read", "Toggle read / unread", () => currentThread && mutateThread(currentThread.hasUnread ? "Marked read" : "Marked unread", currentThread.id, { read: currentThread.hasUnread }), { group: "Triage", disabled: !currentThread }),
      c("mark-all-read", "Mark all as read (this view)", markAllRead, { group: "Triage" }),
      c("archive-all-read", "Archive all read — clear seen mail (this view)", archiveAllRead, { group: "Triage" }),
      c("followup", "Draft follow-up for selected", () => (openEmail ?? current) && startReply((openEmail ?? current)!, followUpDraft((openEmail ?? current)!, personalization)), { group: "AI", disabled: !(openEmail ?? current) }),
      c("personalize", "Teach SuperMail my writing style…", () => goView("settings"), { group: "AI" }),
      c("propose-times", "Reply with my availability", () => (openEmail ?? current) && replyWithTimes((openEmail ?? current)!), { group: "Compose", disabled: !(openEmail ?? current) }),
      c("hold-slot", existingHold ? "Release the tentative hold" : "Hold a tentative slot", () => toggleMeetingHold(), { group: "Compose", disabled: !meetingRequest }),
      c("propose-held-time", "Reply proposing the held time", () => replyWithHeldTime(), { group: "Compose", disabled: !existingHold }),
      c("next-conversation", "Next conversation (open it)", () => openNeighborThread(1), { group: "Navigation", disabled: !threads.length }),
      c("prev-conversation", "Previous conversation (open it)", () => openNeighborThread(-1), { group: "Navigation", disabled: !threads.length }),
      c("goto-inbox", "Go to Inbox", () => goView("inbox"), { group: "Go to" }),
      c("goto-today", "Go to Today — your unified agenda", () => goView("today"), { group: "Go to" }),
      c("goto-focus", "Go to Focus — what needs your attention", () => goView("focus"), { group: "Go to" }),
      c("goto-starred", "Go to Starred", () => goView("starred"), { group: "Go to" }),
      c("goto-snoozed", "Go to Snoozed", () => goView("snoozed"), { group: "Go to" }),
      c("goto-reminders", "Go to Reminders", () => goView("reminders"), { group: "Go to" }),
      c("goto-drafts", "Go to Drafts", () => goView("drafts"), { group: "Go to" }),
      c("goto-outbox", "Go to Outbox", () => goView("outbox"), { group: "Go to" }),
      c("goto-calendar", "Go to Calendar", () => goView("calendar"), { group: "Go to" }),
      c("goto-readstatus", "Go to Sent & Seen (read receipts)", () => goView("readstatus"), { group: "Go to" }),
      c("goto-people", "Go to People (contacts)", () => goView("people"), { group: "Go to" }),
      c("goto-attachments", "Go to Attachments", () => goView("attachments"), { group: "Go to" }),
      c("goto-stats", "Go to Stats (inbox health)", () => goView("stats"), { group: "Go to" }),
      c("send-availability", "Insert availability into a new email", () => composeWithBody(availabilityText()), { group: "Compose" }),
      c("goto-archive", "Go to Done / Archive", () => goView("archive"), { group: "Go to" }),
      c("goto-spam", "Go to Spam", () => goView("spam"), { group: "Go to" }),
      c("goto-trash", "Go to Trash", () => goView("trash"), { group: "Go to" }),
      c("goto-settings", "Open Settings", () => goView("settings"), { group: "Go to" }),
      c(
        "acct-all",
        "Account: All inboxes (unified)",
        () => switchAccount(ALL_ACCOUNTS),
        { group: "Accounts", disabled: activeAccountId === ALL_ACCOUNTS }
      ),
      ...accounts.map((a) =>
        c(`acct-${a.id}`, `Account: ${a.name} — ${a.email}`, () => switchAccount(a.id), {
          group: "Accounts",
          disabled: activeAccountId === a.id,
        })
      ),
      c("save-search", "Save current search as a smart view", saveCurrentSearch, { group: "Search", disabled: !query.trim() }),
      c("gmail-live-search", "Search Gmail live for current query", () => void searchGmailLive(), {
        group: "Search",
        disabled: !gmailProvider || !query.trim() || gmailBusy,
      }),
      ...orderedSavedSearches(savedSearches).map((s) =>
        c(`open-saved-${s.id}`, `Open saved search: ${s.name}`, () => openSavedSearch(s.query, s.id), { group: "Search" })
      ),
      c("help", "Show keyboard shortcuts", () => setShortcutsOpen(true), { group: "Help" }),
      c("tour", "Replay onboarding tour", () => setOnboarding(true), { group: "Help" }),
      c(
        "toggle-auto-advance",
        settings.autoAdvance ? "Turn off auto-advance after triage" : "Turn on auto-advance after triage",
        () => {
          setSettings((s) => ({ ...s, autoAdvance: !s.autoAdvance }));
          flash(settings.autoAdvance ? "Auto-advance off" : "Auto-advance on — jumping to the next conversation after triage");
        },
        { group: "Global" }
      ),
      c(
        "cycle-theme",
        "Cycle to the next theme",
        () => {
          const id = nextTheme(settings.theme);
          setSettings((s) => ({ ...s, theme: id }));
          flash(`Theme: ${getTheme(id).name}`);
        },
        { group: "Appearance" }
      ),
      ...THEMES.map((t) =>
        c(
          `theme-${t.id}`,
          `Theme: ${t.name}`,
          () => {
            setSettings((s) => ({ ...s, theme: t.id }));
            flash(`Theme: ${t.name}`);
          },
          { group: "Appearance", disabled: settings.theme === t.id }
        )
      ),
      c("undo", "Undo last action", doUndo, { group: "Global" }),
      c("redo", "Redo last undone action", doRedo, { group: "Global" }),
      c(
        "reset-shortcuts",
        "Reset keyboard shortcuts to defaults",
        () => {
          setKeymap(resetKeymap());
          flash("Keyboard shortcuts reset to defaults");
        },
        { group: "Global", disabled: Object.keys(keymap).length === 0 }
      ),
      c("reset", "Reset mailbox to seed data", resetMailbox, { group: "Global" }),
    ];
  }, [current, currentThread, openThread, openEmail, startCompose, startReply, archive, trashThread, toggleMute, togglePin, mutateThread, goView, doUndo, doRedo, toggleExpandAll, resetMailbox, flash, composeWithBody, availabilityText, replyWithTimes, doSpam, personalization, savedSearches, saveCurrentSearch, openSavedSearch, searchGmailLive, query, gmailProvider, gmailBusy, autoOrganize, settings.autoAdvance, settings.theme, markAllRead, archiveAllRead, openNeighborThread, threads.length, accounts, activeAccountId, switchAccount, keymap, toggleMeetingHold, replyWithHeldTime, meetingRequest, existingHold]);

  // ---- Render helpers ----
  const target = openEmail ?? current ?? null;
  const targetThread = openThread ?? currentThread;

  // Dispatch a conversation-row hover quick-action to the same handler the
  // keyboard uses. Snooze needs the inline time picker, so it selects the row
  // and opens the menu; the menu targets `openEmail ?? current`, so if a
  // *different* conversation is open in the reader we close it first, otherwise
  // the picker would snooze the wrong thread.
  const runRowAction = (id: RowActionId, thread: Thread, index: number) => {
    switch (id) {
      case "archive": return archive(thread.id);
      case "trash": return trashThread(thread.id);
      case "snooze":
        setSelected(index);
        if (openThreadId && openThreadId !== thread.id) setOpenThreadId(null);
        setMenu("snooze");
        return;
      case "read": return setThreadRead(thread.id, true, "Marked read");
      case "unread": return setThreadRead(thread.id, false, "Marked unread");
      case "pin": case "unpin": return togglePin(thread.id);
      case "restore": return restoreThread(thread.id);
      case "notSpam": return notSpam(thread.id);
      case "deleteForever": return deleteForever(thread.id);
    }
  };
  // Inbox-Zero sweep counts for the current list (drives the split-row actions).
  const sweepReadCount = view === "inbox" ? archiveReadPlan(threads).count : 0;
  const sweepUnreadCount = view === "inbox" ? markAllReadPlan(threads).count : 0;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">⚡ SuperMail</div>

        {/* Multi-account switcher: unified "All inboxes" + one row per account,
            each with its own unread-conversation badge (counted from the full
            mailbox, not the current scope). */}
        <div className="acct-switcher" role="group" aria-label="Accounts">
          <button
            className={`acct-row ${activeAccountId === ALL_ACCOUNTS ? "active" : ""}`}
            onClick={() => switchAccount(ALL_ACCOUNTS)}
            title="All inboxes (unified)"
          >
            <span className="acct-av all">∑</span>
            <span className="acct-name">All inboxes</span>
            {accountUnread(emails, ALL_ACCOUNTS, now) > 0 && (
              <span className="nav-badge">{accountUnread(emails, ALL_ACCOUNTS, now)}</span>
            )}
          </button>
          {accounts.map((a) => {
            const u = accountUnread(emails, a.id, now);
            return (
              <button
                key={a.id}
                className={`acct-row ${activeAccountId === a.id ? "active" : ""}`}
                onClick={() => switchAccount(a.id)}
                title={a.email}
              >
                <span className="acct-av" style={{ background: a.color }}>
                  {accountInitials(a)}
                </span>
                <span className="acct-name">{a.name}</span>
                {u > 0 && <span className="nav-badge">{u}</span>}
              </button>
            );
          })}
        </div>

        <button className="compose-btn" onClick={startCompose}>
          Compose <kbd>C</kbd>
        </button>
        <nav>
          {([
            ["inbox", "Inbox"],
            ["focus", "⚡ Focus"],
            ["today", "🗓 Today"],
            ["starred", "Starred"],
            ["snoozed", "Snoozed"],
            ["reminders", "Reminders"],
            ["drafts", "Drafts"],
            ["outbox", "Outbox"],
            ["calendar", "Calendar"],
            ["readstatus", "Sent & Seen"],
            ["people", "People"],
            ["attachments", "Attachments"],
            ["stats", "Stats"],
            ["archive", "Done"],
            ["spam", "Spam"],
            ["trash", "Trash"],
            ["settings", "Settings"],
          ] as [View, string][]).map(([v, label]) => {
            const badge =
              v === "focus"
                ? focusCount
                : v === "today"
                ? agendaTodayBadge
                : v === "reminders"
                ? reminders.due.length
                : v === "drafts"
                ? drafts.length
                : v === "outbox"
                ? pending(outbox).length
                : v === "snoozed"
                ? scoped.filter((e) => isSnoozed(e, now) && !e.trashed && !isSpam(e)).length
                : v === "calendar"
                ? eventsToday
                : v === "readstatus"
                ? readSummary.awaitingReply
                : v === "spam"
                ? scoped.filter((e) => !e.trashed && isSpam(e)).length
                : 0;
            return (
              <button
                key={v}
                className={`nav-item ${view === v ? "active" : ""}`}
                onClick={() => goView(v)}
              >
                <span>{label}</span>
                {badge > 0 && <span className="nav-badge">{badge}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-section">
          Saved searches
          {query.trim() && view === "search" && !findByQuery(savedSearches, query) && (
            <button className="section-add" title="Save the current search" onClick={saveCurrentSearch}>
              + Save
            </button>
          )}
        </div>
        <div className="label-list">
          {orderedSavedSearches(savedSearches).map((s) => {
            const unread = savedSearchUnreadCount(scoped, s, now);
            return (
              <button
                key={s.id}
                className={`nav-item saved-search ${activeSavedId === s.id ? "active" : ""}`}
                onClick={() => openSavedSearch(s.query, s.id)}
                title={s.query}
              >
                <span className="ss-name">
                  {s.icon && <span className="ss-icon">{s.icon}</span>}
                  {s.name}
                </span>
                <span className="ss-right">
                  {unread > 0 && <span className="nav-badge">{unread}</span>}
                  <span
                    className="ss-del"
                    title="Delete saved search"
                    role="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSavedSearch(s.id);
                    }}
                  >
                    ×
                  </span>
                </span>
              </button>
            );
          })}
          {savedSearches.length === 0 && (
            <div className="muted ss-empty">Search, then “Save” to pin a smart view here.</div>
          )}
        </div>

        <div className="sidebar-section">Labels</div>
        <div className="label-list">
          {labelTree(labels).map((node) => (
            <LabelRow key={node.fullName} node={node} emails={scoped} active={activeLabel} onPick={(name) => { setView("label"); setActiveLabel(name); setOpenThreadId(null); setSelected(0); }} />
          ))}
        </div>

        <div className="mode-pill">
          Mailbox: <strong>{gmailProvider ? "Gmail live" : gmail.enabled ? "Gmail setup" : "Mock"}</strong>
          {gmailProvider && <span className="mode-email">{gmailConnectedEmail}</span>}
        </div>
        <button className="link" onClick={() => setShortcutsOpen(true)}>
          Keyboard shortcuts <kbd>?</kbd>
        </button>
      </aside>

      <main className="main">
        {view === "settings" ? (
          <Settings
            gmail={gmail}
            gmailStatus={{
              busy: gmailBusy,
              connectedEmail: gmailConnectedEmail,
              targetEmail: gmailTargetEmail,
              notice: gmailNotice,
              live: Boolean(gmailProvider),
            }}
            onGmailClientIdChange={updateGmailClientId}
            onConnectGmail={connectGmail}
            onDisconnectGmail={disconnectGmail}
            onReloadGmail={() => void loadGmailInbox()}
            ai={ai}
            settings={settings}
            onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
            accounts={accounts}
            onAccountsChange={setAccounts}
            labels={labels}
            labelCountFor={(name) => emails.filter((e) => e.labels.includes(name)).length}
            onCreateLabel={createLabel}
            onRenameLabel={renameLabelHandler}
            onRecolorLabel={recolorLabelHandler}
            onDeleteLabel={deleteLabelHandler}
            splits={splits}
            onSplitsChange={setSplits}
            snippets={snippets}
            onSnippetsChange={setSnippets}
            blocks={blocks}
            onUnblock={unblock}
            vipOverrides={vipOverrides}
            onClearVip={clearVipFor}
            personalization={personalization}
            onPersonalize={onPersonalize}
            onPersonalizationChange={setPersonalization}
            keymap={keymap}
            onKeymapChange={setKeymap}
            onExportData={exportData}
            onImportData={importData}
            onReset={resetMailbox}
          />
        ) : view === "outbox" ? (
          <OutboxView
            outbox={outbox}
            now={now}
            onCancel={(id) => setOutbox((o) => cancelSend(o, id))}
            onReschedule={(id, at) => {
              setOutbox((o) => rescheduleSend(o, id, at.toISOString()));
              flash("Send rescheduled");
            }}
          />
        ) : view === "drafts" ? (
          <DraftsView drafts={drafts} onResume={resumeDraft} onDelete={deleteDraft} onCompose={startCompose} />
        ) : view === "today" ? (
          <TodayView agenda={agenda} now={now} onOpenItem={openAgendaItem} onItemAction={onAgendaAction} />
        ) : view === "calendar" ? (
          <CalendarView events={calEvents} now={now} onCompose={composeWithBody} onSchedule={holdSlot} onRelease={releaseHold} />
        ) : view === "readstatus" ? (
          <ReadStatusView emails={scoped} now={now} onOpen={openById} onFollowUp={(id) => {
            const e = emails.find((m) => m.id === id);
            if (e) startReply(e, followUpDraft(e, personalization));
          }} />
        ) : view === "people" ? (
          <PeopleView
            emails={scoped}
            selfEmail={settings.selfEmail}
            now={now}
            focusEmail={focusPerson}
            contactNotes={contactNotes}
            onSaveContactNote={saveContactNote}
            onOpenThread={openById}
            onCompose={composeTo}
            vipEmails={vipEmails}
            onToggleVip={toggleVipFor}
          />
        ) : view === "stats" ? (
          <StatsView stats={stats} onGo={goView} />
        ) : view === "attachments" ? (
          <AttachmentsView emails={scoped} onOpen={openById} />
        ) : (
          <>
            <header className="topbar">
              <div className="search-wrap">
                <input
                  id="search-input"
                  className="search"
                  placeholder="Search — from:dana  is:unread  has:attachment  ( / )"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchHelp(true)}
                  onBlur={() => window.setTimeout(() => setSearchHelp(false), 150)}
                />
                {searchHelp && (
                  <div className="search-help">
                    <div className="search-help-title">Search operators — click to insert</div>
                    {SEARCH_OPERATORS.map((o) => (
                      <button
                        key={o.op}
                        className="search-op"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const prefix = o.op.slice(0, o.op.indexOf(":") + 1);
                          setQuery((q) => (q ? q.replace(/\s*$/, " ") : "") + prefix);
                          (document.getElementById("search-input") as HTMLInputElement)?.focus();
                        }}
                      >
                        <code>{o.op}</code>
                        <span className="muted">{o.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className={`scope-pill ${activeAccountId === ALL_ACCOUNTS ? "all" : "scoped"}`}
                title={
                  activeAccountId === ALL_ACCOUNTS
                    ? "Showing all connected inboxes"
                    : `Scoped to ${accountScopeLabel(accounts, activeAccountId)} — click to show all inboxes`
                }
                onClick={() => switchAccount(ALL_ACCOUNTS)}
                disabled={activeAccountId === ALL_ACCOUNTS}
              >
                ◍ {accountScopeLabel(accounts, activeAccountId)}
              </button>
              {liveSource && (
                <span
                  className={`live-pill ${liveSource}`}
                  title={
                    liveSource === "bridge"
                      ? `Real-time Gmail sync — connected as ${liveAccount}. New mail appears here the instant it lands.`
                      : `Showing a captured snapshot of ${liveAccount}. Run \`npm run live\` for always-on real-time sync.`
                  }
                >
                  {liveSource === "bridge" ? "⚡ Live" : "◐ Snapshot"}
                </span>
              )}
              <button className="palette-btn" onClick={() => setAskOpen(true)}>✦ Ask</button>
              <button className="palette-btn" onClick={() => setPaletteOpen(true)}>⌘K</button>
            </header>

            {view === "inbox" && (
              <div className="splits">
                <button
                  key={ALL_SPLIT_TAB.id}
                  className={`split-tab ${activeSplitId === ALL_SPLIT_TAB.id ? "active" : ""}`}
                  onClick={() => { setActiveSplitId(ALL_SPLIT_TAB.id); setSelected(0); }}
                  title="Every inbox conversation in one list (like Superhuman)"
                >
                  {ALL_SPLIT_TAB.icon} {ALL_SPLIT_TAB.name}
                  <span className="count">{visibleForView(scoped, "inbox", now).filter((e) => !e.read).length}</span>
                  <kbd>0</kbd>
                </button>
                {enabledSplits.map((t, i) => (
                  <button
                    key={t.id}
                    className={`split-tab ${activeSplitId === t.id ? "active" : ""}`}
                    onClick={() => { setActiveSplitId(t.id); setSelected(0); }}
                  >
                    {t.icon} {t.name}
                    <span className="count">{splitUnreadCount(visibleForView(scoped, "inbox", now), t)}</span>
                    {i < 9 && <kbd>{i + 1}</kbd>}
                  </button>
                ))}
                {(sweepUnreadCount > 0 || sweepReadCount > 0) && (
                  <div className="split-actions">
                    {sweepUnreadCount > 0 && (
                      <button className="sweep" title="Mark every conversation in this view as read" onClick={markAllRead}>
                        Mark all read
                      </button>
                    )}
                    {sweepReadCount > 0 && (
                      <button className="sweep" title="Archive the conversations you've already read" onClick={archiveAllRead}>
                        Clear read <span className="count">{sweepReadCount}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {view === "inbox" && archiveSuggestions.length > 0 && (
              <div className="suggest-banner">
                ✦ AI suggests archiving {archiveSuggestions.length} low-signal message{archiveSuggestions.length > 1 ? "s" : ""}.
                <button onClick={() => apply(`Auto-archived ${archiveSuggestions.length}`, (prev) => prev.map((e) => (archiveSuggestions.some((c) => c.id === e.id) ? { ...e, archived: true } : e)))}>
                  Archive all
                </button>
              </div>
            )}

            {view === "inbox" && organizePlan.totalLabels > 0 && (
              <div className="suggest-banner">
                ✦ AI can label {organizePlan.changes.length} message{organizePlan.changes.length > 1 ? "s" : ""} ({organizeSummary(organizePlan)}).
                <button onClick={autoOrganize}>Auto-organize</button>
              </div>
            )}

            {view === "inbox" && blockedInbox.length > 0 && (
              <div className="suggest-banner blocked-banner">
                🚫 {blockedInbox.length} message{blockedInbox.length > 1 ? "s" : ""} from unsubscribed / blocked senders.
                <button onClick={archiveBlocked}>Archive all</button>
              </div>
            )}

            {view === "trash" && threads.length > 0 && (
              <div className="suggest-banner">
                🗑 Conversations in Trash are restorable. “Delete forever” removes them permanently from local data.
                <button onClick={emptyTrash}>Empty Trash</button>
              </div>
            )}

            {view === "spam" && threads.length > 0 && (
              <div className="suggest-banner blocked-banner">
                🚫 Suspected spam, kept out of your inbox. Marking spam is local only — SuperMail never reports senders.
              </div>
            )}

            {view === "search" && (
              <div className="suggest-banner search-banner">
                🔎 {activeSavedId ? "Saved search" : "Searching all mail"} ·{" "}
                <code>{query || "(everything)"}</code> · {threads.length} conversation{threads.length === 1 ? "" : "s"}
                {query.trim() && !findByQuery(savedSearches, query) && (
                  <button onClick={saveCurrentSearch}>Save search</button>
                )}
                {gmailProvider && query.trim() && (
                  <button onClick={() => void searchGmailLive()} disabled={gmailBusy}>
                    {gmailBusy ? "Searching Gmail…" : "Search Gmail"}
                  </button>
                )}
              </div>
            )}

            {selection.size > 0 && view !== "reminders" && (
              <div className="bulk-bar">
                <span className="bulk-count">{selection.size} selected</span>
                {view === "trash" ? (
                  <>
                    <button onClick={bulkRestore}>Restore</button>
                    <button className="danger" onClick={bulkDeleteForever}>Delete forever</button>
                  </>
                ) : (
                  <>
                    <button onClick={bulkArchive}>Archive</button>
                    <button onClick={bulkTrash}>Delete</button>
                    <button onClick={bulkRead}>Mark read</button>
                    <button onClick={bulkUnread}>Mark unread</button>
                    <button onClick={bulkStar}>Star</button>
                    <button onClick={() => { setBulkMode(true); setMenu("snooze"); }}>Snooze…</button>
                    <button onClick={() => { setBulkMode(true); setMenu("remind"); }}>Remind…</button>
                    <button onClick={() => { setBulkMode(true); setMenu("label"); }}>Label…</button>
                    <button onClick={() => { setBulkMode(true); setMenu("move"); }}>Move…</button>
                  </>
                )}
                <button className="bulk-allbtn" onClick={selectAllToggle}>
                  {allSelected(threads.map((t) => t.id), selection) ? "Deselect all" : "Select all"}
                </button>
                <button onClick={clearSelection}>Clear</button>
              </div>
            )}

            {view === "reminders" ? (
              <RemindersView buckets={reminders} now={now} emails={scoped} onOpen={openById} onClear={(id) => mutate("Cleared reminder", id, { reminderAt: null, remindIfNoReply: false })} onReschedule={(id, at, ifNoReply) => mutate("Reminder rescheduled", id, { reminderAt: at.toISOString(), remindIfNoReply: ifNoReply, reminderSetAt: new Date().toISOString() })} onFollowUp={(e) => startReply(e, followUpDraft(e, personalization))} />
            ) : (
              <div className="panes">
                <ul className="list">
                  {threads.length === 0 && (
                    <li className="empty">
                      {query
                        ? "No matching mail."
                        : view === "inbox"
                        ? "Inbox zero ✨"
                        : view === "focus"
                        ? "Nothing needs your attention ✨"
                        : view === "trash"
                        ? "Trash is empty."
                        : view === "spam"
                        ? "No spam — nice."
                        : "Nothing here."}
                    </li>
                  )}
                  {threads.map((t, i) => {
                    const picked = selection.has(t.id);
                    return (
                    <li
                      key={t.id}
                      className={`row ${i === selected ? "sel" : ""} ${t.hasUnread ? "unread" : "read"} ${picked ? "picked" : ""}`}
                      onClick={(ev) => {
                        if (ev.shiftKey) { rangeSelect(i); return; }
                        setSelected(i);
                        open(t);
                      }}
                    >
                      <input
                        type="checkbox"
                        className="row-check"
                        checked={picked}
                        aria-label={`Select ${t.subject}`}
                        onClick={(ev) => ev.stopPropagation()}
                        onChange={() => toggleSelect(t.id, i)}
                      />
                      <span className="star" onClick={(ev) => { ev.stopPropagation(); mutateThread(t.starred ? "Unstarred" : "Starred", t.id, { starred: !t.starred }); }}>
                        {t.starred ? "★" : "☆"}
                      </span>
                      <span className="sender">
                        <span className="unread-dot" aria-hidden="true" />
                        {participantsLabel(t)}
                        {t.count > 1 && <span className="thread-pill">{t.count}</span>}
                      </span>
                      <span className="subj">
                        <strong>{t.subject}</strong> <span className="prev">— {t.latest.preview}</span>
                        {view === "focus" && (() => {
                          const reason = threadPriority(t, vipEmails, now).reasons[0];
                          return reason ? <span className="row-focus" title={threadPriority(t, vipEmails, now).reasons.join(" · ")}>⚡ {reason}</span> : null;
                        })()}
                        {t.labels.map((l) => (
                          <span key={l} className="row-label">{l}</span>
                        ))}
                        {t.pinned && <span className="row-pin" title="Pinned">📌</span>}
                        {t.muted && <span className="row-mute" title="Muted">🔕</span>}
                        {hasNote(notes, t.id) && <span className="row-note" title="Has a private note">📝</span>}
                        {t.reminderAt && <span className="row-reminder">⏰ {reminderLabel(t.latest, now)}</span>}
                        {t.hasAttachment && <span className="row-attach">📎</span>}
                      </span>
                      <span className="time">{new Date(t.latestDate).toLocaleDateString()}</span>
                      <span className="row-actions" role="group" aria-label="Quick actions">
                        {rowActions({ hasUnread: t.hasUnread, pinned: t.pinned }, view).map((a) => (
                          <button
                            key={a.id}
                            className="row-act"
                            title={a.label}
                            aria-label={a.label}
                            onClick={(ev) => { ev.stopPropagation(); runRowAction(a.id, t, i); }}
                          >
                            {a.icon}
                          </button>
                        ))}
                      </span>
                    </li>
                    );
                  })}
                </ul>

                <section className="reader">
                  {openThread && openEmail ? (
                    <article>
                      <div className="thread-head">
                        <h2>{openThread.subject}</h2>
                        {openThread.count > 1 && <span className="thread-pill">{openThread.count} messages</span>}
                      </div>

                      {correspondent && (
                        <SenderCard
                          contact={correspondent}
                          stats={correspondentStats}
                          now={now}
                          note={getContactNote(contactNotes, correspondent.email)}
                          onSaveNote={(text) => saveContactNote(correspondent.email, text)}
                          onCompose={() => composeTo(correspondent.email)}
                          onViewPerson={() => viewPerson(correspondent.email)}
                          vip={vipEmails.has(correspondent.email.toLowerCase())}
                          onToggleVip={() => toggleVipFor(correspondent.email, correspondent.name || correspondent.email, !!correspondentStats?.vip)}
                        />
                      )}

                      <div className="ai-summary">{summarizeThread(openThread.messages)} <span className="ai-badge">local</span></div>

                      {meetingRequest && (
                        <div className="meeting-banner">
                          <span className="meeting-icon">📅</span>
                          <span className="meeting-text">
                            Looks like a scheduling request
                            <span className="meeting-why"> — {meetingReasonText(meetingRequest.intent)}</span>
                          </span>
                          {existingHold ? (
                            <>
                              <button
                                className="meeting-cta"
                                title={`Draft a reply proposing your held slot (${holdSummary(existingHold)})`}
                                onClick={replyWithHeldTime}
                              >
                                Propose this time
                              </button>
                              <button
                                className="meeting-hold held"
                                title="Release this tentative hold"
                                onClick={toggleMeetingHold}
                              >
                                📌 Holding {holdSummary(existingHold)} · Release
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="meeting-cta"
                                title={`Draft a reply offering your open ${meetingRequest.intent.durationMinutes}-minute slots`}
                                onClick={() => replyWithTimes(meetingRequest.message, meetingRequest.intent.durationMinutes)}
                              >
                                Reply with availability
                              </button>
                              <button
                                className="meeting-hold"
                                title={`Block a tentative ${meetingRequest.intent.durationMinutes}-minute slot on your calendar (mock)`}
                                onClick={toggleMeetingHold}
                              >
                                📌 Hold a slot
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {actionItems.length > 0 && (
                        <div className="action-items">
                          <div className="action-items-head">
                            ✅ Action items
                            <span className="ai-badge">local</span>
                          </div>
                          <ul>
                            {actionItems.map((it) => {
                              const meta = actionKindMeta(it.kind);
                              return (
                                <li key={it.id}>
                                  <button
                                    className="action-item"
                                    title={`Jump to ${it.from}'s message`}
                                    onClick={() => {
                                      setFocusedMsgId(it.msgId);
                                      setExpandedMsgs((prev) =>
                                        prev.has(it.msgId) ? prev : new Set(prev).add(it.msgId)
                                      );
                                    }}
                                  >
                                    <span className={`action-kind ak-${it.kind}`} title={meta.label}>
                                      {meta.icon}
                                    </span>
                                    <span className="action-text">{it.text}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {commitments.length > 0 && (
                        <div className="action-items commitments">
                          <div className="action-items-head">
                            🤝 Your commitments
                            <span className="ai-badge">local</span>
                          </div>
                          <ul>
                            {commitments.map((it) => (
                              <li key={it.id}>
                                <button
                                  className="action-item"
                                  title={`Jump to your message to ${it.to}`}
                                  onClick={() => {
                                    setFocusedMsgId(it.msgId);
                                    setExpandedMsgs((prev) =>
                                      prev.has(it.msgId) ? prev : new Set(prev).add(it.msgId)
                                    );
                                  }}
                                >
                                  <span
                                    className="action-kind ak-commit"
                                    title={it.hasDeadline ? "You named a deadline" : "Commitment"}
                                  >
                                    {it.hasDeadline ? "⏰" : "🤝"}
                                  </span>
                                  <span className="action-text">{it.text}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {dateMentions.length > 0 && view !== "trash" && view !== "spam" && (
                        <div className="date-mentions">
                          <span className="muted">🕑 Mentioned:</span>
                          {dateMentions.map((dm, i) => (
                            <span key={i} className="dm-chip">
                              <strong>{dm.label}</strong>
                              <button
                                title={`Remind me about this — ${dm.label}`}
                                onClick={() => doRemind(openEmail.id, dm.ms, dm.label, false)}
                              >
                                ⏰ Remind
                              </button>
                              <button
                                title={`Snooze until ${dm.label}`}
                                onClick={() => doSnooze(openThread.id, dm.ms, dm.label)}
                              >
                                💤 Snooze
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <NotePanel
                        value={getNote(notes, openThread.id)}
                        editing={editingNote}
                        onChange={(text) => saveNote(openThread.id, text)}
                        onEditingChange={setEditingNote}
                      />

                      {openThread.messages.length > 1 && (
                        <div className="convo-controls">
                          <button
                            className="expand-all"
                            onClick={toggleExpandAll}
                            title="Expand or collapse every message (O)"
                          >
                            {allExpanded(expandedMsgs, openMsgIds)
                              ? "▾ Collapse all"
                              : `▸ Expand all · ${collapsedCount(expandedMsgs, openMsgIds)} collapsed`}
                            <kbd>O</kbd>
                          </button>
                        </div>
                      )}
                      <div className="conversation">
                        {openThread.messages.map((m) => (
                          <MessageItem
                            key={m.id}
                            m={m}
                            expanded={expandedMsgs.has(m.id)}
                            focused={focusedMsgId === m.id && openThread.messages.length > 1}
                            onToggle={() => {
                              setFocusedMsgId(m.id);
                              setExpandedMsgs((prev) => toggleExpanded(prev, m.id));
                            }}
                            selfEmail={settings.selfEmail}
                            onAction={(actionId) => onMessageAction(actionId, m)}
                            selectionText={readerQuote?.msgId === m.id ? readerQuote.text : ""}
                            onSelectionChange={() => updateReaderQuote(m.id)}
                            onReplySelection={() => replyToReaderQuote(m)}
                            onClearSelection={clearReaderQuote}
                            showReceipts={settings.readReceipts}
                            bridgeMode={liveSource === "bridge"}
                          />
                        ))}
                      </div>

                      {suggestLabels(openEmail).length > 0 && (
                        <div className="label-suggest">
                          <span className="muted">Suggested labels:</span>
                          {suggestLabels(openEmail).map((l) => (
                            <button key={l} className={openThread.labels.includes(l) ? "on" : ""} onClick={() => doLabel(openThread.id, l)}>
                              {openThread.labels.includes(l) ? "✓ " : "+ "}{l}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="instant-replies">
                        {instantReplies(openEmail, personalization).map((r, idx) => (
                          <button key={idx} onClick={() => startReply(openEmail, r)}>{r}</button>
                        ))}
                      </div>
                      {view === "trash" ? (
                        <div className="actions">
                          <button onClick={() => restoreThread(openThread.id)}>♻️ Restore</button>
                          <button className="danger" onClick={() => deleteForever(openThread.id)} title="Permanently remove this conversation from the local store">Delete forever</button>
                        </div>
                      ) : view === "spam" ? (
                        <div className="actions">
                          <button onClick={() => notSpam(openThread.id)} title="Move back to the inbox and remove the Spam label">Not spam</button>
                          <button className="danger" onClick={() => deleteForever(openThread.id)}>Delete forever</button>
                        </div>
                      ) : (
                        <div className="actions">
                          <button onClick={() => startReply(replyTargetMessage(openThread.messages, focusedMsgId) ?? openEmail, undefined, readerSelection())}>Reply <kbd>R</kbd></button>
                          <button onClick={() => archive(openThread.id)}>Archive <kbd>E</kbd></button>
                          <button onClick={() => trashThread(openThread.id)} title="Move to Trash">Delete <kbd>#</kbd></button>
                          <button onClick={() => setMenu("snooze")}>Snooze <kbd>H</kbd></button>
                          <button onClick={() => setMenu("remind")}>Remind me</button>
                          <button onClick={() => setMenu("label")}>Label <kbd>L</kbd></button>
                          <button onClick={() => setMenu("move")} title="Move this conversation into a Split Inbox lane">Move <kbd>V</kbd></button>
                          <button className={openThread.pinned ? "on" : ""} onClick={() => togglePin(openThread.id)} title="Pin to the top of the inbox">{openThread.pinned ? "📌 Pinned" : "Pin"} <kbd>P</kbd></button>
                          <button className={openThread.muted ? "on" : ""} onClick={() => toggleMute(openThread.id)} title="Mute — keep out of the inbox even on new replies">{openThread.muted ? "🔕 Muted" : "Mute"} <kbd>M</kbd></button>
                          <button onClick={() => startReply(openEmail, followUpDraft(openEmail, personalization))}>Follow-up</button>
                          <button onClick={() => replyWithTimes(openEmail)} title="Reply with open times from your calendar">📅 Propose times</button>
                          {isBulkMail(openEmail) && (
                            <button onClick={() => setMenu("unsub")} title="Stop these emails — local only, never contacts the sender">Unsubscribe</button>
                          )}
                          <button onClick={() => doSpam(openEmail)} title="Mark as spam & block sender (local only — not reported)">Spam <kbd>!</kbd></button>
                        </div>
                      )}
                    </article>
                  ) : (
                    <div className="reader-empty">
                      <p>Select a conversation — <kbd>J</kbd>/<kbd>K</kbd> to move, <kbd>Enter</kbd> to open.</p>
                      <p className="muted">Press <kbd>?</kbd> for all shortcuts, <kbd>⌘K</kbd> for commands, <kbd>⌘J</kbd> to ask AI.</p>
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>

      {/* Inline triage menus — single conversation or the current bulk selection */}
      {menu && (target || bulkMode) && (
        <div className="overlay" onClick={() => { setMenu(null); setBulkMode(false); }}>
          <div className="picker" onClick={(e) => e.stopPropagation()}>
            {menu === "snooze" && (
              <>
                <h4>{bulkMode ? `Snooze ${selection.size} conversation${selection.size > 1 ? "s" : ""}` : `Snooze “${target!.subject}”`}</h4>
                <TimePicker
                  presets={SNOOZE_SMART_PRESETS}
                  placeholder="Or type when… “tomorrow 9am”, “next mon”, “in 3 days”"
                  onPick={(at, label) => {
                    const ms = at.getTime() - Date.now();
                    if (bulkMode) bulkSnooze(ms, label);
                    else doSnooze(target!.threadId, ms, label);
                  }}
                />
              </>
            )}
            {menu === "remind" && (target || bulkMode) && (
              <>
                <h4>
                  {bulkMode
                    ? `Remind me about ${selection.size} conversation${selection.size > 1 ? "s" : ""}`
                    : `Remind me about “${target!.subject}”`}
                </h4>
                <RemindPicker
                  presets={REMIND_SMART_PRESETS}
                  onPick={(at, label, ifNoReply) => {
                    const ms = at.getTime() - Date.now();
                    if (bulkMode) bulkRemind(ms, label, ifNoReply);
                    else doRemind(target!.id, ms, label, ifNoReply);
                  }}
                />
              </>
            )}
            {menu === "unsub" && target && (
              <>
                <h4>Unsubscribe from {target.from.name}</h4>
                <p className="picker-note">
                  SuperMail never emails the sender. It archives this thread, labels it
                  “Unsubscribed”, and (optionally) auto-archives future mail from them.
                </p>
                {unsubscribeTarget(target) ? (
                  <p className="unsub-target">
                    List-Unsubscribe link (open manually): <code>{unsubscribeTarget(target)!.uri}</code>
                  </p>
                ) : (
                  <p className="muted">No List-Unsubscribe header found — blocking the sender stops future mail locally.</p>
                )}
                <button onClick={() => doUnsubscribe(target, { alsoBlock: true })}>Unsubscribe &amp; auto-archive future</button>
                <button onClick={() => doUnsubscribe(target, { alsoBlock: true, alsoDomain: true })}>Unsubscribe &amp; block whole domain</button>
                <button onClick={() => doUnsubscribe(target, { alsoBlock: true, alsoTrash: true })}>Unsubscribe &amp; delete this thread</button>
                <button onClick={() => doUnsubscribe(target, {})}>Just archive &amp; label (don’t block)</button>
              </>
            )}
            {menu === "label" && (
              <>
                <h4>{bulkMode ? `Label ${selection.size} conversation${selection.size > 1 ? "s" : ""}` : `Label “${target!.subject}”`}</h4>
                {labels.map((l) => {
                  const on = !bulkMode && (targetThread?.labels ?? target!.labels).includes(l.name);
                  return (
                    <button key={l.id} className={on ? "on" : ""} onClick={() => (bulkMode ? bulkLabel(l.name) : doLabel(target!.threadId, l.name))}>
                      {on ? "✓ " : ""}{l.name}
                    </button>
                  );
                })}
                <LabelCreateRow
                  onCreate={(name) => createLabelAndApply(name, bulkMode ? null : target!.threadId)}
                />
              </>
            )}
            {menu === "move" && (target || bulkMode) && (
              <>
                <h4>{bulkMode ? `Move ${selection.size} conversation${selection.size > 1 ? "s" : ""} to split` : `Move “${target!.subject}” to split`}</h4>
                {enabledSplits.length === 0 && (
                  <p className="muted">No splits are enabled. Turn some on in Settings → Split Inbox.</p>
                )}
                {enabledSplits.map((s) => {
                  const on = !bulkMode && target!.splitOverride === s.id;
                  return (
                    <button key={s.id} className={on ? "on" : ""} onClick={() => (bulkMode ? bulkMove(s.id, s.name) : moveToSplit(target!.threadId, s.id, s.name))}>
                      {on ? "✓ " : ""}{s.icon ? `${s.icon} ` : ""}{s.name}
                    </button>
                  );
                })}
                <button
                  className={!bulkMode && target!.splitOverride == null ? "on" : ""}
                  onClick={() => (bulkMode ? bulkMove(null, "Auto") : moveToSplit(target!.threadId, null, "Auto"))}
                  title="Clear the manual assignment — follow the split rules again"
                >
                  {!bulkMode && target!.splitOverride == null ? "✓ " : ""}↺ Auto (by rules)
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          current={current}
          recentIds={recentCmds}
          commands={commands}
        />
      )}

      {askOpen && (
        <AskPanel
          emails={scoped}
          now={now}
          autoAsk={askInitial}
          onOpenEmail={openById}
          onClose={() => { setAskOpen(false); setAskInitial(undefined); }}
        />
      )}

      {draft && (
        <Compose
          draft={draft}
          snippets={snippets}
          contacts={contacts}
          personalization={personalization}
          accounts={accounts}
          fallbackSignature={settings.signature}
          onChange={setDraft}
          onSend={(d) => queueSend(d, undefined, undefined, settings.sendAndArchive)}
          onSendArchive={(d) => queueSend(d, undefined, undefined, true)}
          onScheduleSend={(d, ms, label) => queueSend(d, new Date(Date.now() + ms).toISOString(), label)}
          onSaveDraft={saveDraft}
          onClose={() => setDraft(null)}
          onRequestAvailability={availabilityText}
        />
      )}

      {shortcutsOpen && <ShortcutsGuide shortcuts={effShortcuts} onClose={() => setShortcutsOpen(false)} />}
      {onboarding && <Onboarding onClose={closeOnboarding} />}

      {toast && (
        <div className="toast">
          {toast.msg}
          {toast.action && (
            <button className="toast-action" onClick={() => { toast.action!.run(); setToast(null); }}>
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Small presentational helpers ----

// Sender insight card — Superhuman's "see everything about the people you email".
// Shows who the open conversation is with (avatar, name, VIP, role · company),
// your relationship history (received / sent / threads / last contact), a private
// note you keep about the person (follows them across threads), and two quick
// actions: email them fresh, or open their full People profile. The stats come
// from the account-scoped contact graph, so they always match the People view;
// identity falls back to the in-thread Contact when there's no wider history
// (e.g. a brand-new sender or an all-outbound thread).
function SenderCard({
  contact,
  stats,
  now,
  note,
  onSaveNote,
  onCompose,
  onViewPerson,
  vip,
  onToggleVip,
}: {
  contact: Contact;
  stats: ContactStats | null;
  now: number;
  note: string;
  onSaveNote: (text: string) => void;
  onCompose: () => void;
  onViewPerson: () => void;
  vip: boolean;
  onToggleVip: () => void;
}) {
  const name = stats?.name || contact.name || contact.email;
  const company = stats?.company ?? contact.company;
  const role = stats?.role ?? contact.role;
  const subtitle = [role, company].filter(Boolean).join(" · ");
  const firstName = name.split(/\s+/)[0];
  const rel = (iso: string) => {
    const ms = Date.parse(iso);
    if (!ms) return "—";
    const d = Math.round((now - ms) / 86_400_000);
    if (d <= 0) return "today";
    if (d === 1) return "yesterday";
    if (d < 30) return `${d}d ago`;
    if (d < 365) return `${Math.round(d / 30)}mo ago`;
    return `${Math.round(d / 365)}y ago`;
  };
  return (
    <div className="sender-card">
      <span className="avatar" style={{ background: avatarColor(contact.email) }} aria-hidden>
        {contactInitials(name)}
      </span>
      <div className="sender-id">
        <div className="sender-name">
          {name}
          <button
            className={`vip-toggle ${vip ? "on" : ""}`}
            onClick={onToggleVip}
            title={vip ? `${name} is a VIP — click to remove` : `Mark ${name} as a VIP (boost in Focus)`}
          >
            {vip ? "★ VIP" : "☆ VIP"}
          </button>
        </div>
        <div className="muted sender-email">{contact.email}</div>
        {subtitle && <div className="muted sender-role">{subtitle}</div>}
      </div>
      <div className="sender-stats" title="Your history with this person">
        {stats ? (
          <>
            <span><strong>{stats.received}</strong> received</span>
            <span><strong>{stats.sent}</strong> sent</span>
            <span><strong>{stats.threads}</strong> {stats.threads === 1 ? "thread" : "threads"}</span>
            <span className="muted">Last {rel(stats.lastInteraction)}</span>
          </>
        ) : (
          <span className="muted">First conversation</span>
        )}
      </div>
      <div className="sender-actions">
        <button onClick={onCompose} title={`Compose a new email to ${name}`}>✉ Email</button>
        <button onClick={onViewPerson} title="See your full history with this person">👤 History</button>
      </div>

      <ContactNoteField key={contact.email} note={note} firstName={firstName} onSave={onSaveNote} />
    </div>
  );
}

// A private, local-only note on the open conversation. Collapsed to a single
// "Add note" affordance when empty and not editing; shows the note (click to
// edit) when one exists; an autofocusing textarea while editing. Saving an empty
// note clears it (handled upstream by setNote).
function NotePanel({
  value,
  editing,
  onChange,
  onEditingChange,
}: {
  value: string;
  editing: boolean;
  onChange: (text: string) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) {
      const el = ref.current;
      el?.focus();
      // Land the caret at the end of any existing text.
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing]);

  if (!editing) {
    if (!value) {
      return (
        <button className="note-add" onClick={() => onEditingChange(true)} title="Add a private note (n)">
          📝 Add note
        </button>
      );
    }
    return (
      <div className="note-panel readonly" onClick={() => onEditingChange(true)} title="Click to edit (n)">
        <div className="note-head">
          <span>📝 Private note</span>
          <span className="muted">click to edit · local only</span>
        </div>
        <div className="note-body">{value}</div>
      </div>
    );
  }
  return (
    <div className="note-panel">
      <div className="note-head">
        <span>📝 Private note</span>
        <span className="muted">local only · never sent</span>
      </div>
      <textarea
        ref={ref}
        className="note-input"
        value={value}
        placeholder="Jot a private reminder about this conversation…"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onEditingChange(false)}
        onKeyDown={(e) => {
          // Esc / Cmd+Enter finish editing without leaking to the global key map.
          if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            e.stopPropagation();
            onEditingChange(false);
          }
        }}
      />
    </div>
  );
}

// Inline "create a new label" row for the label menu — type a name, Enter or
// "+ Create" makes it (de-duped) and applies it to the target in one step.
function LabelCreateRow({ onCreate }: { onCreate: (name: string) => void }) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onCreate(t);
    setText("");
  };
  return (
    <div className="label-create">
      <input
        placeholder="New label…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
      />
      <button onClick={submit} disabled={!text.trim()}>+ Create</button>
    </div>
  );
}

// One message inside a conversation. Older messages start collapsed (Gmail/
// Superhuman style); click the header to expand.
function MessageItem({
  m,
  expanded,
  focused,
  onToggle,
  selfEmail,
  onAction,
  selectionText,
  onSelectionChange,
  onReplySelection,
  onClearSelection,
  showReceipts,
  bridgeMode,
}: {
  m: Email;
  expanded: boolean;
  focused?: boolean;
  onToggle: () => void;
  selfEmail: string;
  onAction: (id: MessageActionId) => void;
  selectionText?: string;
  onSelectionChange: () => void;
  onReplySelection: () => void;
  onClearSelection: () => void;
  showReceipts: boolean;
  bridgeMode: boolean;
}) {
  // Trim quoted reply history (Gmail/Superhuman "show trimmed content"): show
  // only what the sender wrote this time, with the quoted trail behind a toggle.
  const { visible, quoted } = useMemo(() => splitQuoted(m.body), [m.body]);
  const onlyQuoted = visible.trim().length === 0 && quoted !== null;
  const [showQuoted, setShowQuoted] = useState(false);
  // Per-message actions (reply / reply-all / forward / copy) for the expanded row.
  const actions = useMemo(() => messageActions(m, selfEmail), [m, selfEmail]);
  return (
    <div
      id={`msg-${m.id}`}
      className={`msg ${m.outbound ? "outbound" : ""} ${expanded ? "open" : "collapsed"} ${focused ? "focused" : ""}`}
    >
      <button className="msg-head" onClick={onToggle}>
        <span className="msg-from">
          <strong>{m.outbound ? "You" : m.from.name}</strong>
          {!m.outbound && m.from.company && <span className="chip">{m.from.company}</span>}
        </span>
        {!expanded && <span className="msg-snippet">{m.preview}</span>}
        <span className="msg-when">{new Date(m.date).toLocaleString()}</span>
      </button>
      {expanded && (
        <>
          {m.outbound && showReceipts && (
            <div className="read-status">
              Read receipt:{" "}
              {m.openedByRecipientAt
                ? `opened ${new Date(m.openedByRecipientAt).toLocaleString()}`
                : "unavailable"}
              <span className="muted"> — Gmail's API doesn't expose opens; shown as a placeholder.</span>
            </div>
          )}
          {bridgeMode ? (
            <MessageBody
              messageId={m.id}
              fallbackText={visible}
              onSelectionChange={onSelectionChange}
              hide={onlyQuoted}
            />
          ) : (
            !onlyQuoted && <pre className="body" onMouseUp={onSelectionChange}>{visible}</pre>
          )}
          {selectionText && (
            <div className="selection-reply">
              <span>
                <strong>{selectionWordCount(selectionText)} words</strong>
                <span className="selection-preview">{selectionPreview(selectionText, 90)}</span>
              </span>
              <button
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={onReplySelection}
                title="Quote only this selected text"
              >
                Reply to selection
              </button>
              <button
                className="ghost"
                onMouseDown={(ev) => ev.preventDefault()}
                onClick={onClearSelection}
              >
                Clear
              </button>
            </div>
          )}
          {quoted && (
            <div className="quoted">
              <button
                className="quote-toggle"
                onClick={() => setShowQuoted((v) => !v)}
                title={showQuoted ? "Hide quoted history" : "Show the trimmed quoted history"}
              >
                {showQuoted ? "▾ Hide trimmed content" : `••• Show trimmed content · ${quotedLineCount(quoted)} lines`}
              </button>
              {(showQuoted || onlyQuoted) && <pre className="body quoted-body" onMouseUp={onSelectionChange}>{quoted}</pre>}
            </div>
          )}
          <div className="msg-actions">
            {actions.map((a) => (
              <button
                key={a.id}
                className="msg-action"
                title={a.title}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onAction(a.id);
                }}
              >
                <span aria-hidden="true">{a.icon}</span> {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LabelRow({
  node,
  emails,
  active,
  onPick,
}: {
  node: ReturnType<typeof labelTree>[number];
  emails: Email[];
  active: string | null;
  onPick: (name: string) => void;
}) {
  const count = labelCount(emails, node.fullName);
  return (
    <>
      <button className={`label-item ${active === node.fullName ? "active" : ""}`} onClick={() => onPick(node.fullName)}>
        <span>{node.segment}</span>
        {count > 0 && <span className="count">{count}</span>}
      </button>
      {node.children.length > 0 && (
        <div className="label-children">
          {node.children.map((child) => (
            <LabelRow key={child.fullName} node={child} emails={emails} active={active} onPick={onPick} />
          ))}
        </div>
      )}
    </>
  );
}

function OutboxView({
  outbox,
  now,
  onCancel,
  onReschedule,
}: {
  outbox: OutboxItem[];
  now: number;
  onCancel: (id: string) => void;
  onReschedule: (id: string, at: Date) => void;
}) {
  // Which scheduled item is currently showing its reschedule picker.
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  if (outbox.length === 0) {
    return (
      <div className="state-view">
        <h2>Outbox</h2>
        <p className="muted">Nothing scheduled. Use “Send later” in compose, or send normally to get a 10-second undo window. (All sends are a local simulation — SuperMail never delivers real mail.)</p>
      </div>
    );
  }
  return (
    <div className="state-view">
      <h2>Outbox</h2>
      <ul className="outbox-list">
        {outbox.map((item) => {
          // Only a genuinely scheduled (future) send can be moved or recalled —
          // not one inside its 10s undo window, which is about to leave.
          const future = item.status === "scheduled" && new Date(item.sendAt).getTime() - now > 60_000;
          return (
            <li key={item.id} className={`outbox-item ${item.status}`}>
              <div className="outbox-main">
                <strong>{item.draft.subject || "(no subject)"}</strong>
                <span className="muted"> → {item.draft.to || "—"}</span>
              </div>
              <div className="outbox-meta">
                <span className={`pill ${item.status}`}>{item.status}</span>
                {item.status === "scheduled" && <span>{sendLaterLabel(item, now)}</span>}
                {future && (
                  <button onClick={() => setRescheduling((r) => (r === item.id ? null : item.id))}>
                    {rescheduling === item.id ? "Close" : "Reschedule"}
                  </button>
                )}
                {canUndo(item, now) && <button onClick={() => onCancel(item.id)}>Cancel</button>}
              </div>
              {rescheduling === item.id && (
                <div className="outbox-reschedule">
                  <TimePicker
                    presets={SEND_LATER_SMART_PRESETS}
                    placeholder="Reschedule to… “tomorrow 8am”, “mon 9am”, “in 2 hours”"
                    onPick={(at) => {
                      onReschedule(item.id, at);
                      setRescheduling(null);
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AttachmentsView({ emails, onOpen }: { emails: Email[]; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const all = useMemo(() => collectAttachments(emails), [emails]);
  const breakdown = useMemo(() => attachmentBreakdown(all), [all]);
  const shown = useMemo(() => filterAttachments(all, q), [all, q]);
  return (
    <div className="state-view attach-view">
      <h2>Attachments <span className="muted">({all.length})</span></h2>
      <p className="muted">Every file across your mailbox, newest first. Search by name, sender, subject, or <code>kind:pdf</code>.</p>
      <div className="attach-controls">
        <input
          className="search"
          placeholder="Search files…  (kind:pdf, kind:image, deck, Dana)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {breakdown.length > 0 && (
        <div className="attach-chips">
          <button className={q === "" ? "on" : ""} onClick={() => setQ("")}>All {all.length}</button>
          {breakdown.map((b) => (
            <button key={b.kind} className={q === `kind:${b.kind}` ? "on" : ""} onClick={() => setQ(`kind:${b.kind}`)}>
              {attachmentIcon(b.kind)} {b.kind} {b.count}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="muted">{all.length === 0 ? "No attachments in the mailbox." : "No files match your search."}</p>
      ) : (
        <ul className="attach-list">
          {shown.map((a: AttachmentRef, i) => (
            <li key={`${a.messageId}-${a.filename}-${i}`} className="attach-item">
              <button className="attach-open" onClick={() => onOpen(a.messageId)}>
                <span className="attach-icon">{attachmentIcon(a.kind)}</span>
                <span className="attach-main">
                  <strong>{a.filename}</strong>
                  <span className="muted">{a.from} · {a.subject}</span>
                </span>
                <span className="attach-date muted">{new Date(a.date).toLocaleDateString()}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatsView({ stats, onGo }: { stats: InboxStats; onGo: (v: View) => void }) {
  const healthLabel =
    stats.health >= 85 ? "Excellent" : stats.health >= 60 ? "Good" : stats.health >= 30 ? "Busy" : "Overloaded";
  const route: Record<string, View> = {
    needsReply: "inbox",
    reminders: "reminders",
    readstatus: "readstatus",
    archive: "inbox",
    unread: "inbox",
  };
  const actions = nextActions(stats);
  const tiles: { label: string; value: string | number; view?: View }[] = [
    { label: "Inbox", value: stats.inbox, view: "inbox" },
    { label: "Unread", value: stats.unread, view: "inbox" },
    { label: "Needs reply", value: stats.needsReply, view: "inbox" },
    { label: "Awaiting reply", value: stats.awaitingReply, view: "readstatus" },
    { label: "Reminders due", value: stats.remindersDue, view: "reminders" },
    { label: "Snoozed", value: stats.snoozed, view: "snoozed" },
    { label: "Scheduled", value: stats.scheduled, view: "outbox" },
    { label: "Starred", value: stats.starred, view: "starred" },
    { label: "Open rate", value: `${Math.round(stats.openRate * 100)}%`, view: "readstatus" },
    { label: "Spam", value: stats.spam, view: "spam" },
  ];
  return (
    <div className="state-view stats-view">
      <h2>Inbox health</h2>
      <p className="muted">
        A deterministic snapshot of your mailbox — computed on-device, nothing leaves the browser.
      </p>

      <div className="stats-top">
        <div className={`health-card h-${healthLabel.toLowerCase()}`}>
          <div className="health-score">{stats.health}</div>
          <div className="health-label">{healthLabel}</div>
        </div>
        <div className="cleared-card">
          {stats.inboxZero ? (
            <div className="inbox-zero">🎉 Inbox zero — you're all caught up.</div>
          ) : (
            <>
              <div className="cleared-head">
                <strong>{stats.handled}</strong> of {stats.total} conversations cleared
              </div>
              <div className="cleared-bar">
                <div className="cleared-fill" style={{ width: `${Math.round(stats.clearedPct * 100)}%` }} />
              </div>
              <div className="muted">{stats.inbox} still in the inbox</div>
            </>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="next-actions">
          <h3>What to do next</h3>
          <ul>
            {actions.map((a) => (
              <li key={a.key}>
                <button onClick={() => onGo(route[a.key] ?? "inbox")}>
                  <span className="na-count">{a.count}</span> {a.label} →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="stat-tiles">
        {tiles.map((t) => (
          <button key={t.label} className="stat-tile" onClick={() => t.view && onGo(t.view)}>
            <span className="stat-value">{t.value}</span>
            <span className="stat-label">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DraftsView({
  drafts,
  onResume,
  onDelete,
  onCompose,
}: {
  drafts: Draft[];
  onResume: (d: Draft) => void;
  onDelete: (id: string) => void;
  onCompose: () => void;
}) {
  if (drafts.length === 0) {
    return (
      <div className="state-view">
        <h2>Drafts</h2>
        <p className="muted">
          No saved drafts. Hit <kbd>C</kbd> to compose, then “Save draft” to park a message here —
          it's kept locally and is always reviewed by you before you send it manually from Gmail.
        </p>
        <button className="add-btn" onClick={onCompose}>Compose</button>
      </div>
    );
  }
  return (
    <div className="state-view">
      <h2>Drafts <span className="muted">({drafts.length})</span></h2>
      <p className="muted">Saved locally. SuperMail never sends — open one to keep editing, then send it yourself from Gmail.</p>
      <ul className="outbox-list">
        {drafts.map((d) => (
          <li key={d.id} className="outbox-item draft-item">
            <button className="draft-open" onClick={() => onResume(d)}>
              <strong>{d.subject || "(no subject)"}</strong>
              <span className="muted"> → {d.to || "—"}</span>
              <span className="draft-preview">{(d.body || "").replace(/\s+/g, " ").trim().slice(0, 90) || "Empty draft"}</span>
            </button>
            <div className="outbox-meta">
              {d.scheduledAt && <span className="pill scheduled">scheduled</span>}
              {d.inReplyTo && <span className="pill">reply</span>}
              <button onClick={() => onResume(d)}>Edit</button>
              <button className="danger" onClick={() => onDelete(d.id)}>Discard</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReadStatusView({
  emails,
  now,
  onOpen,
  onFollowUp,
}: {
  emails: Email[];
  now: number;
  onOpen: (id: string) => void;
  onFollowUp: (id: string) => void;
}) {
  const [windowMs, setWindowMs] = useState(FEED_WINDOWS[1].ms); // default: 7 days
  const summary = readStatusSummary(emails);
  const feed = getReadStatusFeed(
    emails,
    { since: new Date(now - windowMs).toISOString(), limit: 200 },
    now
  );
  const rel = (iso: string) => {
    const h = Math.round((now - Date.parse(iso)) / 3600_000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  };
  return (
    <div className="state-view">
      <h2>Sent &amp; Seen</h2>
      <p className="muted">
        Read receipts for mail you've sent — who opened it, when, and on what device. Open times are
        real mailbox data; the device is illustrative. Gmail's API can't report opens, so this mirrors
        Superhuman's read-status feed shape (a tracking backend would populate it live).
      </p>
      <div className="read-summary">
        <span><strong>{summary.opened}</strong> opened</span>
        <span><strong>{summary.sent}</strong> sent</span>
        <span><strong>{Math.round(summary.openRate * 100)}%</strong> open rate</span>
        <span><strong>{summary.awaitingReply}</strong> awaiting reply</span>
        <select value={windowMs} onChange={(e) => setWindowMs(Number(e.target.value))}>
          {FEED_WINDOWS.map((w) => (
            <option key={w.label} value={w.ms}>Last {w.label}</option>
          ))}
        </select>
      </div>
      {feed.events.length === 0 ? (
        <p className="muted">No opens in this window. Mail you've sent shows here once it's opened.</p>
      ) : (
        <ul className="read-list">
          {feed.events.map((ev) => (
            <li key={ev.id} className={`read-item ${ev.awaitingReply ? "awaiting" : ""}`}>
              <button className="read-open" onClick={() => onOpen(ev.messageId)}>
                <strong>{ev.subject}</strong>
                <span className="muted"> → {ev.recipient}</span>
              </button>
              <span className="read-when">
                {deviceIcon(ev.device)} opened {rel(ev.openedAt)}
                {ev.awaitingReply && <span className="awaiting-pill">no reply yet</span>}
              </span>
              {ev.awaitingReply && (
                <button className="read-followup" onClick={() => onFollowUp(ev.messageId)}>
                  Follow up
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RemindersView({
  buckets,
  now,
  emails,
  onOpen,
  onClear,
  onReschedule,
  onFollowUp,
}: {
  buckets: { due: Email[]; upcoming: Email[] };
  now: number;
  emails: Email[];
  onOpen: (id: string) => void;
  onClear: (id: string) => void;
  onReschedule: (id: string, at: Date, ifNoReply: boolean) => void;
  onFollowUp: (e: Email) => void;
}) {
  void emails;
  // Which reminder is currently showing its reschedule picker.
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const Section = ({ title, items, dueStyle }: { title: string; items: Email[]; dueStyle?: boolean }) => (
    <section className="rem-section">
      <h3>{title} <span className="muted">({items.length})</span></h3>
      {items.length === 0 && <p className="muted">Nothing here.</p>}
      <ul className="rem-list">
        {items.map((e) => (
          <li key={e.id} className={dueStyle ? "due" : ""}>
            <button className="rem-open" onClick={() => onOpen(e.id)}>
              <strong>{e.subject}</strong>
              <span className="muted"> — {e.from.name}</span>
            </button>
            <span className="rem-when">{reminderLabel(e, now)}</span>
            <div className="rem-actions">
              {e.remindIfNoReply && reminderDue(e, [e], now) && (
                <button onClick={() => onFollowUp(e)}>Draft follow-up</button>
              )}
              <button onClick={() => setRescheduling((r) => (r === e.id ? null : e.id))}>
                {rescheduling === e.id ? "Close" : "Reschedule"}
              </button>
              <button onClick={() => onClear(e.id)}>Clear</button>
            </div>
            {rescheduling === e.id && (
              <div className="rem-reschedule">
                <RemindPicker
                  presets={REMIND_SMART_PRESETS}
                  onPick={(at, _label, ifNoReply) => {
                    onReschedule(e.id, at, ifNoReply);
                    setRescheduling(null);
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <div className="reminders-view">
      <Section title="Due now" items={buckets.due} dueStyle />
      <Section title="Upcoming" items={buckets.upcoming} />
    </div>
  );
}
