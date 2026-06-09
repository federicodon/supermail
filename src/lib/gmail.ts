// Gmail integration architecture.
//
// This module documents and wires the OAuth 2.0 + REST flow used when
// VITE_MAILBOX_MODE=gmail and real Google OAuth credentials are provided.
// In development (default) the app runs entirely on the mock mailbox, so none
// of this needs real credentials to build or run.
//
// SAFETY: nothing here is executed against a live account in dev/CI. The REST
// layer is expressed as pure request *builders* ({method,url,headers,body}) so
// the logic is unit-tested without a network, and the mock provider mirrors the
// exact same surface (see provider.ts).

import type { Contact, Draft, Email } from "../types";
import { SendBlockedError, stripSendScopes } from "./safety";

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  enabled: boolean;
  targetEmail?: string;
  oauthFlow: "pkce" | "token";
}

export function loadGmailConfig(): GmailConfig {
  const env = import.meta.env;
  const scopes = (env.VITE_GOOGLE_SCOPES ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  return {
    clientId: env.VITE_GOOGLE_CLIENT_ID ?? "",
    clientSecret: env.VITE_GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: env.VITE_GOOGLE_REDIRECT_URI ?? "http://localhost:5273/oauth2/callback",
    // Least privilege: gmail.modify covers read/label/archive/draft. Any
    // `gmail.send` scope is stripped — SuperMail never requests send access.
    scopes: stripSendScopes(scopes.length ? scopes : ["https://www.googleapis.com/auth/gmail.modify"]),
    enabled: (env.VITE_MAILBOX_MODE ?? "mock") === "gmail",
    targetEmail: env.VITE_GMAIL_TARGET_ACCOUNT ?? "",
    oauthFlow: env.VITE_GOOGLE_OAUTH_FLOW === "pkce" ? "pkce" : "token",
  };
}

export function isGmailConfigured(cfg: GmailConfig): boolean {
  return cfg.enabled && !!cfg.clientId;
}

// ---- Portable base64url (browser + node) ----------------------------------

export function base64UrlBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 =
    typeof btoa !== "undefined"
      ? btoa(binary)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Buffer.from(binary, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64Url(input: string): string {
  return base64UrlBytes(new TextEncoder().encode(input));
}

export function decodeBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const bin =
    typeof atob !== "undefined"
      ? atob(b64)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Buffer.from(b64, "base64").toString("binary");
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---- PKCE (RFC 7636) + state/nonce hardening ------------------------------

const PKCE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

// Monotonic seed so the non-WebCrypto fallback still yields distinct values
// across calls (e.g. so state !== nonce). Real entropy comes from WebCrypto
// whenever it is present (all browsers + modern Node).
let fallbackSeed = 0x9e3779b9;
function defaultRandomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(out);
  } else {
    for (let i = 0; i < n; i++) {
      fallbackSeed = (fallbackSeed * 1103515245 + 12345) & 0x7fffffff;
      out[i] = (fallbackSeed >>> 16) & 0xff;
    }
  }
  return out;
}

// High-entropy code verifier (43–128 chars from the unreserved set).
export function generateCodeVerifier(
  length = 64,
  randomBytes: (n: number) => Uint8Array = defaultRandomBytes
): string {
  const len = Math.min(128, Math.max(43, length));
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += PKCE_CHARS[bytes[i] % PKCE_CHARS.length];
  return out;
}

export async function sha256Bytes(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const subtle = (globalThis as { crypto?: Crypto }).crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", data);
    return new Uint8Array(digest);
  }
  // Portable fallback for environments without WebCrypto (older Node test
  // runners). Pure-JS SHA-256 keeps PKCE deterministic everywhere.
  return sha256Fallback(data);
}

// Self-contained SHA-256 (FIPS 180-4). Used only when WebCrypto subtle is
// unavailable so the OAuth/PKCE path stays testable in any runtime.
function sha256Fallback(msg: Uint8Array): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ];
  const l = msg.length;
  const withOne = new Uint8Array((((l + 8) >> 6) + 1) * 64);
  withOne.set(msg);
  withOne[l] = 0x80;
  const bitLen = l * 8;
  const dv = new DataView(withOne.buffer);
  dv.setUint32(withOne.length - 4, bitLen >>> 0, false);
  dv.setUint32(withOne.length - 8, Math.floor(bitLen / 0x100000000), false);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  const w = new Uint32Array(64);
  for (let off = 0; off < withOne.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  const out = new Uint8Array(32);
  const odv = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, h[i] >>> 0, false);
  return out;
}

// S256 challenge = base64url(sha256(verifier)).
export async function pkceChallenge(verifier: string): Promise<string> {
  return base64UrlBytes(await sha256Bytes(verifier));
}

export interface PkceSession {
  verifier: string;
  challenge: string;
  state: string;
  nonce: string;
}

export async function createPkceSession(
  randomBytes: (n: number) => Uint8Array = defaultRandomBytes
): Promise<PkceSession> {
  const verifier = generateCodeVerifier(64, randomBytes);
  const challenge = await pkceChallenge(verifier);
  return {
    verifier,
    challenge,
    state: base64UrlBytes(randomBytes(16)),
    nonce: base64UrlBytes(randomBytes(16)),
  };
}

// Step 1 of the OAuth 2.0 Authorization Code flow. With `pkce` the URL carries
// the S256 challenge so a public client never needs to ship the secret.
export function buildAuthUrl(
  cfg: GmailConfig,
  state: string,
  pkce?: { challenge: string; nonce?: string }
): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: cfg.scopes.join(" "),
    state,
  });
  if (pkce?.challenge) {
    params.set("code_challenge", pkce.challenge);
    params.set("code_challenge_method", "S256");
  }
  if (pkce?.nonce) params.set("nonce", pkce.nonce);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Browser-only OAuth token flow for the local SPA. Google returns a short-lived
// access token in the redirect hash, so no client secret is shipped to the app.
export function buildTokenAuthUrl(cfg: GmailConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "token",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: cfg.scopes.join(" "),
    state,
  });
  if (cfg.targetEmail) params.set("login_hint", cfg.targetEmail);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Validate the callback `state` matches what we issued (CSRF guard).
export function verifyState(expected: string, got: string | null): boolean {
  return !!expected && !!got && expected === got;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  // Absolute expiry (ms epoch) computed from expires_in at receipt time.
  expiresAt: number;
  scope?: string;
}

interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

interface OAuthErrorResponse {
  error?: string;
  error_description?: string;
}

function toTokenSet(raw: RawTokenResponse, now: number): TokenSet {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token,
    expiresAt: now + raw.expires_in * 1000,
    scope: raw.scope,
  };
}

// Treat a token as expired a little early so an in-flight request never 401s.
export function isTokenExpired(token: TokenSet, now: number, skewMs = 60_000): boolean {
  return token.expiresAt - skewMs <= now;
}

async function oauthErrorMessage(res: Response, fallback: string): Promise<string> {
  let detail = "";
  try {
    const raw = await res.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as OAuthErrorResponse;
        detail = [parsed.error, parsed.error_description].filter(Boolean).join(": ");
      } catch {
        detail = raw;
      }
    }
  } catch {
    /* response body unavailable */
  }
  return detail ? `${fallback}: ${res.status} (${detail})` : `${fallback}: ${res.status}`;
}

// Step 2: exchange the authorization code for tokens (PKCE: send verifier, no
// secret needed for a public client). In a packaged app this belongs on a small
// backend; here it is the documented integration point and is never run in dev.
export async function exchangeCodeForTokens(
  cfg: GmailConfig,
  code: string,
  codeVerifier?: string,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch
): Promise<TokenSet> {
  const body: Record<string, string> = {
    code,
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  };
  if (codeVerifier) body.code_verifier = codeVerifier;
  if (cfg.clientSecret) body.client_secret = cfg.clientSecret;
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(await oauthErrorMessage(res, "Token exchange failed"));
  return toTokenSet((await res.json()) as RawTokenResponse, now);
}

// Refresh an access token using the long-lived refresh token.
export async function refreshAccessToken(
  cfg: GmailConfig,
  refreshToken: string,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch
): Promise<TokenSet> {
  const body: Record<string, string> = {
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    grant_type: "refresh_token",
  };
  if (cfg.clientSecret) body.client_secret = cfg.clientSecret;
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  if (!res.ok) throw new Error(await oauthErrorMessage(res, "Token refresh failed"));
  const next = toTokenSet((await res.json()) as RawTokenResponse, now);
  // Google omits a new refresh_token on refresh; keep the existing one.
  if (!next.refreshToken) next.refreshToken = refreshToken;
  return next;
}

// ---- REST request builders (pure; unit-tested without network) ------------

export interface RestRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: string;
}

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

function authHeaders(accessToken: string, json = false): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

export interface ListQuery {
  q?: string; // Gmail search syntax, e.g. "in:inbox is:unread"
  labelIds?: string[];
  maxResults?: number;
  pageToken?: string;
}

export function listMessagesRequest(token: string, query: ListQuery = {}): RestRequest {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.maxResults) params.set("maxResults", String(query.maxResults));
  if (query.pageToken) params.set("pageToken", query.pageToken);
  for (const id of query.labelIds ?? []) params.append("labelIds", id);
  const qs = params.toString();
  return {
    method: "GET",
    url: `${API}/messages${qs ? `?${qs}` : ""}`,
    headers: authHeaders(token),
  };
}

export function getMessageRequest(token: string, id: string, format = "full"): RestRequest {
  return {
    method: "GET",
    url: `${API}/messages/${encodeURIComponent(id)}?format=${format}`,
    headers: authHeaders(token),
  };
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
}

export function getProfileRequest(token: string): RestRequest {
  return {
    method: "GET",
    url: `${API}/profile`,
    headers: authHeaders(token),
  };
}

export interface GmailLabel {
  id: string;
  name: string;
  type?: "system" | "user";
  color?: {
    textColor?: string;
    backgroundColor?: string;
  };
}

export function listLabelsRequest(token: string): RestRequest {
  return {
    method: "GET",
    url: `${API}/labels`,
    headers: authHeaders(token),
  };
}

export function modifyMessageRequest(
  token: string,
  id: string,
  addLabelIds: string[],
  removeLabelIds: string[]
): RestRequest {
  return {
    method: "POST",
    url: `${API}/messages/${encodeURIComponent(id)}/modify`,
    headers: authHeaders(token, true),
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  };
}

export function archiveRequest(token: string, id: string): RestRequest {
  // Archiving in Gmail = remove the INBOX label.
  return modifyMessageRequest(token, id, [], ["INBOX"]);
}

export function markReadRequest(token: string, id: string, read: boolean): RestRequest {
  return read
    ? modifyMessageRequest(token, id, [], ["UNREAD"])
    : modifyMessageRequest(token, id, ["UNREAD"], []);
}

export function trashRequest(token: string, id: string): RestRequest {
  return {
    method: "POST",
    url: `${API}/messages/${encodeURIComponent(id)}/trash`,
    headers: authHeaders(token),
  };
}

// Build an RFC 822 message and base64url-encode it for the Gmail send/draft API.
export function buildRawMessage(draft: Draft, from = "me"): string {
  const headers: string[] = [];
  if (from && from !== "me") headers.push(`From: ${from}`);
  headers.push(`To: ${draft.to}`);
  if (draft.cc) headers.push(`Cc: ${draft.cc}`);
  if (draft.bcc) headers.push(`Bcc: ${draft.bcc}`);
  headers.push(`Subject: ${draft.subject}`);
  if (draft.inReplyTo) {
    headers.push(`In-Reply-To: ${draft.inReplyTo}`);
    headers.push(`References: ${draft.inReplyTo}`);
  }
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push("MIME-Version: 1.0");
  const raw = headers.join("\r\n") + "\r\n\r\n" + (draft.body ?? "");
  return base64Url(raw);
}

// BLOCKED: building (and therefore calling) the Gmail send endpoint is
// permanently disabled by SuperMail's safety policy. The function is kept so the
// guarantee is explicit and testable — invoking it throws instead of producing a
// request. Use `createDraftRequest` and let the human send from Gmail.
export function sendMessageRequest(_token: string, _draft: Draft, _threadId?: string): never {
  throw new SendBlockedError("users.messages.send");
}

export function createDraftRequest(token: string, draft: Draft, threadId?: string): RestRequest {
  const message: Record<string, unknown> = { raw: buildRawMessage(draft) };
  if (threadId) message.threadId = threadId;
  return {
    method: "POST",
    url: `${API}/drafts`,
    headers: authHeaders(token, true),
    body: JSON.stringify({ message }),
  };
}

// ---- Gmail message JSON -> our Email shape --------------------------------

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPayload {
  headers?: GmailHeader[];
  mimeType?: string;
  filename?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
}
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string; // ms epoch as string
  payload?: GmailPayload;
}

function headerValue(payload: GmailPayload | undefined, name: string): string {
  return (
    payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
}

function parseFrom(value: string): { name: string; email: string } {
  const m = value.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim() || m[2].trim(), email: m[2].trim() };
  return { name: value.trim(), email: value.trim() };
}

export function parseAddressList(value: string): Contact[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  let angleDepth = 0;
  for (const ch of value) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === "<") angleDepth += 1;
    if (!quoted && ch === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (ch === "," && !quoted && angleDepth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.map(parseFrom).filter((c) => c.email);
}

function extractBody(payload: GmailPayload | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  for (const part of payload.parts ?? []) {
    const found = extractBody(part);
    if (found) return found;
  }
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}

function collectAttachments(payload: GmailPayload | undefined, out: string[] = []): string[] {
  if (!payload) return out;
  if (payload.filename?.trim()) out.push(payload.filename.trim());
  for (const part of payload.parts ?? []) collectAttachments(part, out);
  return out;
}

function categoryFromLabels(labelIds: string[]): Email["category"] {
  if (labelIds.includes("CATEGORY_SOCIAL")) return "social";
  if (labelIds.includes("CATEGORY_PROMOTIONS") || labelIds.includes("CATEGORY_UPDATES"))
    return "news";
  if (labelIds.includes("IMPORTANT")) return "important";
  return "other";
}

export function normalizeMessage(msg: GmailMessage, selfEmail = "me"): Email {
  const labelIds = msg.labelIds ?? [];
  const from = parseFrom(headerValue(msg.payload, "From"));
  const toRaw = headerValue(msg.payload, "To");
  const ccRaw = headerValue(msg.payload, "Cc");
  const listUnsubscribe = headerValue(msg.payload, "List-Unsubscribe") || undefined;
  const listUnsubscribePost = headerValue(msg.payload, "List-Unsubscribe-Post");
  const body = extractBody(msg.payload) || msg.snippet || "";
  const date = msg.internalDate
    ? new Date(Number(msg.internalDate)).toISOString()
    : new Date(0).toISOString();
  return {
    id: msg.id,
    threadId: msg.threadId,
    from,
    to: toRaw ? parseAddressList(toRaw) : [{ name: "You", email: selfEmail }],
    cc: ccRaw ? parseAddressList(ccRaw) : undefined,
    subject: headerValue(msg.payload, "Subject") || "(no subject)",
    preview: msg.snippet ?? body.slice(0, 140),
    body,
    date,
    read: !labelIds.includes("UNREAD"),
    starred: labelIds.includes("STARRED"),
    archived: !labelIds.includes("INBOX"),
    category: categoryFromLabels(labelIds),
    labels: labelIds.filter((l) => !l.startsWith("CATEGORY_")),
    attachments: collectAttachments(msg.payload),
    snoozedUntil: null,
    reminderAt: null,
    openedByRecipientAt: null,
    outbound: labelIds.includes("SENT"),
    listUnsubscribe,
    listUnsubscribePost: /List-Unsubscribe=One-Click/i.test(listUnsubscribePost),
  };
}

export function gmailLabelMaps(labels: GmailLabel[]) {
  const idToName = new Map<string, string>();
  const nameToId = new Map<string, string>();
  for (const l of labels) {
    idToName.set(l.id, l.name);
    nameToId.set(l.name.toLowerCase(), l.id);
  }
  return { idToName, nameToId };
}

export function normalizeMessageWithLabels(
  msg: GmailMessage,
  selfEmail = "me",
  labelMap: Map<string, string> = new Map()
): Email {
  const e = normalizeMessage(msg, selfEmail);
  return {
    ...e,
    labels: e.labels.map((l) => labelMap.get(l) ?? l),
  };
}

// The Gmail REST endpoints the client calls once authorized. Kept as a map so
// Settings can display the integration surface without a live connection.
export const GMAIL_ENDPOINTS = {
  profile: "GET https://gmail.googleapis.com/gmail/v1/users/me/profile",
  listMessages: "GET https://gmail.googleapis.com/gmail/v1/users/me/messages",
  getMessage: "GET https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}",
  labels: "GET https://gmail.googleapis.com/gmail/v1/users/me/labels",
  modify: "POST https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}/modify",
  send: "DISABLED — users.messages.send is blocked by SuperMail safety policy",
  draftsSend: "DISABLED — users.drafts.send is blocked by SuperMail safety policy",
  drafts: "POST https://gmail.googleapis.com/gmail/v1/users/me/drafts (create only)",
  trash: "POST https://gmail.googleapis.com/gmail/v1/users/me/messages/{id}/trash",
  watch: "POST https://gmail.googleapis.com/gmail/v1/users/me/watch",
} as const;
