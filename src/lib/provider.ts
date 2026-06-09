// Unified mail provider.
//
// Both the mock mailbox and the real Gmail REST adapter implement the SAME
// MailProvider interface, so every UI action ("archive", "send", "label"…) runs
// identically in mock mode and in Gmail mode. Tests exercise the mock provider;
// the Gmail provider reuses the pure request builders in gmail.ts and only adds
// fetch + token handling.
//
// SAFETY: the Gmail provider is never instantiated in dev/CI (mock is the
// default) and never touches a live account without explicit configuration.

import type { Draft, Email } from "../types";
import { assertNotSend, SendBlockedError } from "./safety";
import {
  archiveRequest,
  createDraftRequest,
  getProfileRequest,
  getMessageRequest,
  gmailLabelMaps,
  isTokenExpired,
  listLabelsRequest,
  listMessagesRequest,
  markReadRequest,
  modifyMessageRequest,
  normalizeMessageWithLabels,
  refreshAccessToken,
  trashRequest,
  type GmailConfig,
  type GmailLabel,
  type GmailMessage,
  type ListQuery,
  type RestRequest,
  type TokenSet,
} from "./gmail";

export interface SendResult {
  id: string;
}

export interface MailProvider {
  readonly mode: "mock" | "gmail";
  list(query?: ListQuery): Promise<Email[]>;
  get(id: string): Promise<Email | null>;
  archive(id: string): Promise<void>;
  setRead(id: string, read: boolean): Promise<void>;
  setStar(id: string, starred: boolean): Promise<void>;
  modifyLabels(id: string, add: string[], remove: string[]): Promise<void>;
  trash(id: string): Promise<void>;
  // `send` is a LOCAL simulation only (mock provider). The Gmail provider
  // refuses it — real sending is permanently disabled. Use `createDraft` for
  // anything that touches a live account; the human sends from Gmail.
  send(draft: Draft, threadId?: string): Promise<SendResult>;
  createDraft(draft: Draft, threadId?: string): Promise<SendResult>;
}

// ---- Mock provider --------------------------------------------------------
//
// Holds the in-memory mailbox as the single source of truth. All mutations go
// through here so the UI can re-read a consistent snapshot, exactly like the
// Gmail provider returns server state.

export class MockProvider implements MailProvider {
  readonly mode = "mock" as const;
  private store: Email[];
  private seq = 0;

  constructor(seed: Email[]) {
    // Clone so the seed array is never mutated.
    this.store = seed.map((e) => ({ ...e }));
  }

  private idx(id: string): number {
    return this.store.findIndex((e) => e.id === id);
  }

  async list(query?: ListQuery): Promise<Email[]> {
    let out = this.store.map((e) => ({ ...e }));
    if (query?.q) {
      const t = query.q.toLowerCase();
      out = out.filter((e) =>
        [e.subject, e.body, e.from.name, e.from.email].join(" ").toLowerCase().includes(t)
      );
    }
    return out;
  }

  async get(id: string): Promise<Email | null> {
    const e = this.store[this.idx(id)];
    return e ? { ...e } : null;
  }

  private patch(id: string, patch: Partial<Email>): void {
    const i = this.idx(id);
    if (i >= 0) this.store[i] = { ...this.store[i], ...patch };
  }

  async archive(id: string): Promise<void> {
    this.patch(id, { archived: true });
  }
  async setRead(id: string, read: boolean): Promise<void> {
    this.patch(id, { read });
  }
  async setStar(id: string, starred: boolean): Promise<void> {
    this.patch(id, { starred });
  }
  async modifyLabels(id: string, add: string[], remove: string[]): Promise<void> {
    const e = this.store[this.idx(id)];
    if (!e) return;
    const labels = new Set(e.labels);
    for (const l of add) labels.add(l);
    for (const l of remove) labels.delete(l);
    this.patch(id, { labels: [...labels] });
  }
  async trash(id: string): Promise<void> {
    const i = this.idx(id);
    if (i >= 0) this.store.splice(i, 1);
  }

  // LOCAL-ONLY simulation: records an outbound message in the in-memory store so
  // the demo's outbox / follow-up / reply detection work. Never touches a
  // network or a real account — there is no way for this to deliver mail.
  async send(draft: Draft, threadId?: string): Promise<SendResult> {
    this.seq += 1;
    const id = `sent-${this.seq}`;
    // Record the outbound message so follow-up / reply detection works in mock.
    this.store.unshift({
      id,
      threadId: threadId ?? draft.threadId ?? `t-${id}`,
      from: { name: "You", email: "federicodonatone1@gmail.com" },
      to: draft.to ? [{ name: draft.to, email: draft.to }] : [],
      subject: draft.subject,
      preview: draft.body.slice(0, 140),
      body: draft.body,
      date: new Date().toISOString(),
      read: true,
      starred: false,
      archived: true, // sent items aren't in the inbox
      category: "other",
      labels: ["SENT"],
      attachments: [],
      snoozedUntil: null,
      reminderAt: null,
      openedByRecipientAt: null,
      outbound: true,
    });
    return { id };
  }

  async createDraft(draft: Draft): Promise<SendResult> {
    this.seq += 1;
    return { id: `draft-${this.seq}-${draft.subject.slice(0, 8)}` };
  }
}

// ---- Gmail provider -------------------------------------------------------

// A token store that yields a valid access token, refreshing when needed.
export interface TokenStore {
  get(): TokenSet | null;
  set(token: TokenSet): void;
}

export class MemoryTokenStore implements TokenStore {
  private token: TokenSet | null;
  constructor(initial: TokenSet | null = null, private onSet?: (token: TokenSet) => void) {
    this.token = initial;
  }
  get() {
    return this.token;
  }
  set(token: TokenSet) {
    this.token = token;
    this.onSet?.(token);
  }
}

const browserFetch: typeof fetch = (input, init) => fetch(input, init);

export class GmailProvider implements MailProvider {
  readonly mode = "gmail" as const;
  private labelCache: Promise<GmailLabel[]> | null = null;

  constructor(
    private cfg: GmailConfig,
    private tokens: TokenStore,
    private selfEmail = "me",
    private fetchImpl: typeof fetch = browserFetch,
    private now: () => number = () => Date.now()
  ) {}

  private async accessToken(): Promise<string> {
    const token = this.tokens.get();
    if (!token) throw new Error("Gmail not authorized");
    if (isTokenExpired(token, this.now()) && token.refreshToken) {
      const next = await refreshAccessToken(this.cfg, token.refreshToken, this.now(), this.fetchImpl);
      this.tokens.set(next);
      return next.accessToken;
    }
    return token.accessToken;
  }

  private async exec<T>(build: (token: string) => RestRequest): Promise<T> {
    const token = await this.accessToken();
    const req = build(token);
    // Belt-and-suspenders: refuse any request that targets a send endpoint,
    // even if a builder were added in the future.
    assertNotSend(req.url);
    const res = await this.fetchImpl(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
    if (!res.ok) throw new Error(`Gmail ${req.method} ${req.url} -> ${res.status}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  async profile(): Promise<{ emailAddress: string; messagesTotal?: number; threadsTotal?: number; historyId?: string }> {
    return this.exec((t) => getProfileRequest(t));
  }

  async listLabels(): Promise<GmailLabel[]> {
    if (!this.labelCache) {
      this.labelCache = this.exec<{ labels?: GmailLabel[] }>((t) => listLabelsRequest(t)).then(
        (res) => res.labels ?? []
      ).catch((err) => {
        this.labelCache = null;
        throw err;
      });
    }
    return this.labelCache;
  }

  private async labelMaps(opts: { allowEmptyFallback?: boolean } = {}) {
    try {
      return gmailLabelMaps(await this.listLabels());
    } catch (err) {
      if (opts.allowEmptyFallback) return gmailLabelMaps([]);
      throw err;
    }
  }

  private async resolveLabelIds(labels: string[]): Promise<string[]> {
    if (!labels.length) return [];
    const { nameToId } = await this.labelMaps();
    return labels.map((l) => nameToId.get(l.toLowerCase()) ?? l);
  }

  async list(query: ListQuery = { q: "in:inbox", maxResults: 50 }): Promise<Email[]> {
    const maxResults = Math.max(1, query.maxResults ?? 50);
    const ids: string[] = [];
    let pageToken = query.pageToken;
    const singlePage = !!query.pageToken;
    do {
      const remaining = maxResults - ids.length;
      const listed = await this.exec<{ messages?: { id: string }[]; nextPageToken?: string }>((t) =>
        listMessagesRequest(t, { ...query, maxResults: Math.min(500, remaining), pageToken })
      );
      ids.push(...(listed.messages ?? []).map((m) => m.id));
      pageToken = listed.nextPageToken;
    } while (!singlePage && pageToken && ids.length < maxResults);

    const { idToName } = await this.labelMaps({ allowEmptyFallback: true });
    const msgs = await Promise.all(ids.map((id) => this.getWithLabels(id, idToName)));
    return msgs.filter((m): m is Email => m !== null);
  }

  async get(id: string): Promise<Email | null> {
    const { idToName } = await this.labelMaps({ allowEmptyFallback: true });
    return this.getWithLabels(id, idToName);
  }

  private async getWithLabels(id: string, idToName: Map<string, string>): Promise<Email | null> {
    const msg = await this.exec<GmailMessage>((t) => getMessageRequest(t, id));
    return msg?.id ? normalizeMessageWithLabels(msg, this.selfEmail, idToName) : null;
  }

  async archive(id: string): Promise<void> {
    await this.exec((t) => archiveRequest(t, id));
  }
  async setRead(id: string, read: boolean): Promise<void> {
    await this.exec((t) => markReadRequest(t, id, read));
  }
  async setStar(id: string, starred: boolean): Promise<void> {
    await this.exec((t) =>
      starred ? modifyMessageRequest(t, id, ["STARRED"], []) : modifyMessageRequest(t, id, [], ["STARRED"])
    );
  }
  async modifyLabels(id: string, add: string[], remove: string[]): Promise<void> {
    const [addIds, removeIds] = await Promise.all([
      this.resolveLabelIds(add),
      this.resolveLabelIds(remove),
    ]);
    await this.exec((t) => modifyMessageRequest(t, id, addIds, removeIds));
  }
  async trash(id: string): Promise<void> {
    await this.exec((t) => trashRequest(t, id));
  }
  // Permanently blocked: SuperMail never sends from a live Gmail account. This
  // throws before any token is read or any request is built. Create a draft and
  // send it manually from Gmail instead.
  async send(_draft: Draft, _threadId?: string): Promise<SendResult> {
    throw new SendBlockedError("GmailProvider.send");
  }
  async createDraft(draft: Draft, threadId?: string): Promise<SendResult> {
    const res = await this.exec<{ id: string }>((t) => createDraftRequest(t, draft, threadId));
    return { id: res.id };
  }
}

// Factory: pick the provider based on config. Defaults to mock so dev/CI never
// require credentials.
export function createProvider(opts: {
  gmail: GmailConfig;
  seed: Email[];
  tokens?: TokenStore;
  selfEmail?: string;
  fetchImpl?: typeof fetch;
}): MailProvider {
  if (opts.gmail.enabled && opts.gmail.clientId && opts.tokens?.get()) {
    return new GmailProvider(opts.gmail, opts.tokens, opts.selfEmail, opts.fetchImpl);
  }
  return new MockProvider(opts.seed);
}
