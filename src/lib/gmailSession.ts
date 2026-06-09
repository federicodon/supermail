import type { PkceSession, TokenSet } from "./gmail";

const CLIENT_ID_KEY = "supermail.gmail.clientId.v1";
const TOKEN_KEY = "supermail.gmail.tokens.v1";
const PKCE_KEY = "supermail.gmail.pkce.v1";
const ACCOUNT_KEY = "supermail.gmail.account.v1";

function readJson<T>(store: Storage | undefined, key: string): T | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(store: Storage | undefined, key: string, value: unknown): void {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

function remove(store: Storage | undefined, key: string): void {
  try {
    store?.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

function local(): Storage | undefined {
  return typeof window !== "undefined" ? window.localStorage : undefined;
}

function session(): Storage | undefined {
  return typeof window !== "undefined" ? window.sessionStorage : undefined;
}

export function loadGmailClientId(envClientId = ""): string {
  return (readJson<string>(local(), CLIENT_ID_KEY) ?? envClientId).trim();
}

export function saveGmailClientId(clientId: string): void {
  const next = clientId.trim();
  if (!next) remove(local(), CLIENT_ID_KEY);
  else writeJson(local(), CLIENT_ID_KEY, next);
}

export function loadGmailTokens(): TokenSet | null {
  return readJson<TokenSet>(session(), TOKEN_KEY);
}

export function saveGmailTokens(tokens: TokenSet): void {
  writeJson(session(), TOKEN_KEY, tokens);
}

export function clearGmailTokens(): void {
  remove(session(), TOKEN_KEY);
}

export function loadGmailPkceSession(): PkceSession | null {
  return readJson<PkceSession>(session(), PKCE_KEY);
}

export function saveGmailPkceSession(pkce: PkceSession): void {
  writeJson(session(), PKCE_KEY, pkce);
}

export function clearGmailPkceSession(): void {
  remove(session(), PKCE_KEY);
}

export function loadGmailAccountEmail(): string {
  return readJson<string>(session(), ACCOUNT_KEY) ?? "";
}

export function saveGmailAccountEmail(email: string): void {
  writeJson(session(), ACCOUNT_KEY, email);
}

export function clearGmailAccountEmail(): void {
  remove(session(), ACCOUNT_KEY);
}

export function clearGmailSession(): void {
  clearGmailTokens();
  clearGmailPkceSession();
  clearGmailAccountEmail();
}
