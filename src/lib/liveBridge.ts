// Browser transport for the live Gmail sync bridge (see server/).
//
// Source precedence the app uses to populate the mailbox:
//   1. live bridge   GET /api/state  + SSE /api/stream   (always-on, real-time)
//   2. local snapshot GET /live-snapshot.json            (one-off real capture)
//   3. bundled mock seed                                  (no setup)
//
// EventSource reconnects automatically if the bridge restarts, so "always synced"
// survives laptop sleep / bridge restarts without app intervention.

import type { Email } from "../types";
import type { LiveSnapshot } from "./liveSync";

const API_BASE = "/api";
const SNAPSHOT_URL = "/live-snapshot.json";

export type LiveSource = "bridge" | "snapshot";

export interface LiveInit {
  source: LiveSource;
  snapshot: LiveSnapshot;
}

async function getJson<T>(url: string, timeoutMs = 2000): Promise<T | null> {
  if (typeof fetch === "undefined") return null;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { signal: ctrl?.signal, headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Is the always-on bridge reachable right now? (Cheap health probe.)
export async function probeBridge(): Promise<{ account: string; count: number } | null> {
  return getJson<{ account: string; count: number }>(`${API_BASE}/health`, 1500);
}

// Re-fetch just the static snapshot (used to poll for refreshes in snapshot mode).
export async function fetchLocalSnapshot(): Promise<LiveSnapshot | null> {
  const snap = await getJson<LiveSnapshot>(`${SNAPSHOT_URL}?t=${Date.now()}`, 2500);
  return snap && Array.isArray(snap.emails) ? snap : null;
}

// Pick the best available real-mail source for the initial load.
export async function loadInitialLiveMailbox(): Promise<LiveInit | null> {
  const bridge = await getJson<LiveSnapshot>(`${API_BASE}/state`, 2500);
  if (bridge && Array.isArray(bridge.emails)) return { source: "bridge", snapshot: bridge };

  const snap = await getJson<LiveSnapshot>(SNAPSHOT_URL, 2500);
  if (snap && Array.isArray(snap.emails) && snap.emails.length) {
    return { source: "snapshot", snapshot: snap };
  }
  return null;
}

export interface LiveHandlers {
  onHello?(info: { account: string }): void;
  onUpsert?(emails: Email[]): void;
  onExpunge?(ids: string[]): void;
  onResync?(snapshot: LiveSnapshot): void;
  onOpen?(): void;
  onError?(): void;
}

export interface LiveStream {
  close(): void;
}

// Open the SSE stream and dispatch typed events. Returns a disposer. No-op (with
// a null disposer behaviour) when EventSource is unavailable (SSR/tests).
export function connectLiveStream(handlers: LiveHandlers): LiveStream {
  if (typeof EventSource === "undefined") {
    return { close() {} };
  }
  const es = new EventSource(`${API_BASE}/stream`);

  es.addEventListener("open", () => handlers.onOpen?.());
  es.addEventListener("error", () => handlers.onError?.());

  es.addEventListener("hello", (ev) => {
    const data = parse<{ account: string }>(ev);
    if (data) handlers.onHello?.(data);
  });
  es.addEventListener("upsert", (ev) => {
    const data = parse<{ emails: Email[] }>(ev);
    if (data?.emails?.length) handlers.onUpsert?.(data.emails);
  });
  es.addEventListener("expunge", (ev) => {
    const data = parse<{ ids: string[] }>(ev);
    if (data?.ids?.length) handlers.onExpunge?.(data.ids);
  });
  es.addEventListener("resync", (ev) => {
    const data = parse<LiveSnapshot>(ev);
    if (data?.emails) handlers.onResync?.(data);
  });

  return {
    close() {
      es.close();
    },
  };
}

function parse<T>(ev: MessageEvent): T | null {
  try {
    return JSON.parse(ev.data) as T;
  } catch {
    return null;
  }
}

// ---- two-way write-back (triage actions -> Gmail via the bridge) ------------
export type ModifyAction = "read" | "unread" | "star" | "unstar" | "trash" | "archive";

// Write a triage action back to Gmail through the bridge's IMAP connection.
// Fire-and-forget: resolves true on success, false (never throws) otherwise, so
// callers can ignore the result and keep the optimistic local update.
export async function postBridgeModify(id: string, action: ModifyAction): Promise<boolean> {
  if (typeof fetch === "undefined") return false;
  try {
    const res = await fetch(`${API_BASE}/modify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---- on-demand full message (HTML + inline images + attachments) ------------
export interface MessageAttachmentMeta {
  filename: string;
  contentType: string;
  size: number;
  cid: string | null;
  index: number;
  inline: boolean;
}
export interface MessageView {
  id: string;
  html: string;
  text: string;
  attachments: MessageAttachmentMeta[];
}

// Fetch the full, on-demand message body + attachments from the bridge. Returns
// null on any failure so callers fall back to the cached flattened text.
export async function fetchMessageView(id: string): Promise<MessageView | null> {
  const v = await getJson<MessageView>(`${API_BASE}/message?id=${encodeURIComponent(id)}`, 8000);
  return v && Array.isArray(v.attachments) ? v : null;
}

// Absolute (same-origin) URL for downloading an attachment.
export function attachmentDownloadUrl(id: string, index: number): string {
  return `${API_BASE}/attachment?id=${encodeURIComponent(id)}&index=${index}`;
}

export function formatBytes(n: number): string {
  if (!n || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
