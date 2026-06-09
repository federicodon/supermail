// SuperMail live sync bridge — real-time Gmail mirror + owner-authorized send/triage.
//
// Keeps one IMAP connection open to Gmail with IDLE on "[Gmail]/All Mail", so
// the moment a message arrives (or you send one) Gmail pushes it here and we
// stream it to the SuperMail UI over SSE — no polling, sub-second latency. It
// also serves the built UI (../dist) so this single process is the whole app.
//
//   Gmail  --IMAP IDLE-->  bridge  --SSE-->  SuperMail (browser)
//
// SCOPE: reads/mirrors over IMAP, serves the static UI, and exposes exactly two
// owner-authorized, HUMAN-TRIGGERED mutation paths:
//   • POST /api/send   — Gmail SMTP. Reached ONLY when the UI's undo-send window
//                        elapses after a human pressed Send in Compose.
//   • POST /api/modify — IMAP write-back of read/star/trash/archive triage.
// The Gmail REST send endpoints (users.messages.send / users.drafts.send) stay
// permanently blocked in src/lib/safety.ts; no agent or test path can auto-send.
// Credentials come from a local, git-ignored .env (a Gmail App Password) and are
// never logged or persisted.

import http from "node:http";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize, extname, sep } from "node:path";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import { normalizeImapMessage } from "./lib/normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- static UI (vite build output) -----------------------------------------
// Serve the built SPA from ../dist so the bridge is the single always-on
// process: UI + API + SSE all same-origin on PORT. Any non-/api request maps to
// a file under dist/, falling back to dist/index.html for client routes.
const DIST_DIR = join(__dirname, "..", "dist");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

async function sendFile(res, absPath, status = 200) {
  const data = await readFile(absPath);
  res.writeHead(status, {
    "Content-Type": MIME[extname(absPath).toLowerCase()] || "application/octet-stream",
  });
  res.end(data);
}

// Resolve a URL pathname to a safe file inside DIST_DIR (blocks ../ traversal).
function resolveDistPath(pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    rel = pathname;
  }
  if (rel === "/" || rel === "") rel = "/index.html";
  if (rel.split(/[\\/]/).includes("..")) return null; // explicit traversal guard
  const abs = normalize(join(DIST_DIR, rel));
  if (abs !== DIST_DIR && !abs.startsWith(DIST_DIR + sep)) return null;
  return abs;
}

async function serveStatic(req, res, pathname) {
  const abs = resolveDistPath(pathname);
  if (!abs) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("forbidden");
    return;
  }
  try {
    const st = await stat(abs);
    if (st.isFile()) {
      await sendFile(res, abs);
      return;
    }
  } catch {
    /* not a file — fall through to SPA index */
  }
  try {
    await sendFile(res, join(DIST_DIR, "index.html"));
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("dist/ not built — run `npm run build` first.");
  }
}

// ---- config (.env.local / .env — both git-ignored, never committed) --------
// Reads the same env files Vite uses (.env then .env.local, latter wins) so you
// keep one local config file. Non-VITE_ vars (the App Password) are never
// exposed to the browser bundle by Vite — only this Node process reads them.
function loadEnvFile(path, env) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (line.trim().startsWith("#")) continue;
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
        v = v.slice(1, -1);
      env[m[1]] = v;
    }
  } catch {
    /* file absent — fine */
  }
}

function loadEnv() {
  const env = {};
  loadEnvFile(join(__dirname, "..", ".env"), env);
  loadEnvFile(join(__dirname, "..", ".env.local"), env); // .local overrides
  return { ...env, ...process.env }; // real process env wins over files
}

const ENV = loadEnv();
const USER = (ENV.GMAIL_USER || "").trim();
const PASS = (ENV.GMAIL_APP_PASSWORD || "").replace(/\s+/g, ""); // app passwords show with spaces
const PORT = Number(ENV.BRIDGE_PORT || 8787);
const BACKFILL = Math.max(20, Number(ENV.GMAIL_BACKFILL || 200));
const POLL_MS = Math.max(20_000, Number(ENV.GMAIL_POLL_MS || 90_000));
const MAILBOX = ENV.GMAIL_MAILBOX || "[Gmail]/All Mail";
const SELF = [
  USER,
  ...(ENV.GMAIL_SELF || "federico@growthcab.com,federicodonatone1@gmail.com")
    .split(",")
    .map((s) => s.trim()),
].filter(Boolean);

if (!USER || !PASS) {
  console.error(
    "\n[bridge] Missing credentials. Create supermail/.env.local with:\n" +
      "  GMAIL_USER=federico.donatone@growthcab.com\n" +
      "  GMAIL_APP_PASSWORD=your-16-char-app-password\n" +
      "See server/README or the SuperMail README → 'Live sync'.\n"
  );
  process.exit(1);
}

// ---- SMTP send transport (human-triggered only; see POST /api/send) ---------
// SAFETY: this is the ONLY outbound mail path in SuperMail. It is reached solely
// by POST /api/send, which the browser calls ONLY when an outbox item's
// undo-send window has elapsed (a human pressed Send in Compose). No agent or
// test path calls it. From is forced to USER so Gmail never rewrites/rejects it.
const smtp = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // implicit TLS
  auth: { user: USER, pass: PASS },
});

// ---- in-memory mirror + SSE fan-out ----------------------------------------
const LABEL_COLORS = {
  Partnerships: "#42d692",
  Network: "#ff7537",
  Journalist: "#4986e7",
};

const mailbox = new Map(); // id -> Email
const uidById = new Map(); // hex emailId -> IMAP uid (for /api/modify write-back)
let liveClient = null; // the currently-connected ImapFlow instance (or null)
let connected = false;
const sseClients = new Set();

function snapshot() {
  const emails = [...mailbox.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const names = new Set();
  for (const e of emails) for (const l of e.labels) names.add(l);
  const labels = [...names].sort().map((name) => ({
    id: `gmail-${name}`,
    name,
    color: LABEL_COLORS[name],
    system: false,
  }));
  return { account: USER, source: "bridge", connected, generatedAt: new Date().toISOString(), emails, labels };
}

function sseSend(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function broadcast(event, data) {
  for (const res of sseClients) {
    try {
      sseSend(res, event, data);
    } catch {
      sseClients.delete(res);
    }
  }
}

// Merge fetched messages into the mirror; broadcast only what actually changed.
function ingest(emails) {
  const changed = [];
  for (const e of emails) {
    const prev = mailbox.get(e.id);
    if (!prev || prev._sig !== sig(e)) {
      e._sig = sig(e);
      mailbox.set(e.id, e);
      changed.push(e);
    }
  }
  if (changed.length) broadcast("upsert", { emails: changed.map(strip) });
  return changed.length;
}

function sig(e) {
  return [e.read, e.starred, e.archived, e.trashed, e.labels.join(","), e.subject, e.body.length].join("|");
}
function strip(e) {
  const { _sig, ...rest } = e;
  return rest;
}

// ---- IMAP fetch helpers -----------------------------------------------------
function addrList(list) {
  if (!list) return undefined;
  return {
    value: list.map((a) => ({
      name: a.name || "",
      address: a.address && a.host ? `${a.address}@${a.host}` : a.address || "",
    })),
  };
}
function parsedFromEnvelope(env) {
  if (!env) return {};
  return {
    from: addrList(env.from),
    to: addrList(env.to),
    cc: addrList(env.cc),
    subject: env.subject || "",
    date: env.date,
    messageId: env.messageId,
    text: "",
  };
}

async function fetchRange(client, range, { full = false, byUid = false } = {}) {
  const out = [];
  let maxUid = 0;
  const query = {
    uid: true,
    envelope: true,
    flags: true,
    labels: true,
    emailId: true,
    threadId: true,
    source: !!full,
  };
  // 3rd arg { uid: true } makes `range` a UID range (stable across expunges).
  for await (const msg of client.fetch(range, query, byUid ? { uid: true } : undefined)) {
    if (msg.uid && msg.uid > maxUid) maxUid = msg.uid;
    let parsed = null;
    if (full && msg.source) {
      try {
        parsed = await simpleParser(msg.source);
      } catch {
        parsed = null;
      }
    }
    if (!parsed) parsed = parsedFromEnvelope(msg.envelope);
    const email = normalizeImapMessage(msg, parsed, SELF);
    // Remember the IMAP uid for this hex id so /api/modify can write back.
    if (msg.uid) uidById.set(email.id, msg.uid);
    // On light (no-source) fetches, keep the body we already cached.
    if (!full) {
      const cached = mailbox.get(email.id);
      if (cached) {
        email.body = cached.body;
        email.preview = cached.preview;
        email.attachments = cached.attachments;
      }
    }
    out.push(email);
  }
  return { emails: out, maxUid };
}

// Reconcile a recent window: upsert current state and drop messages that
// vanished from the mailbox (trashed / deleted in Gmail) so the mirror matches.
function reconcile(fetched) {
  ingest(fetched);
  if (!fetched.length) return;
  const seen = new Set(fetched.map((e) => e.id));
  const oldest = fetched.reduce((m, e) => Math.min(m, Date.parse(e.date)), Infinity);
  const removed = [];
  for (const [id, e] of mailbox) {
    if (!seen.has(id) && Date.parse(e.date) >= oldest) {
      mailbox.delete(id);
      uidById.delete(id);
      removed.push(id);
    }
  }
  if (removed.length) broadcast("expunge", { ids: removed });
}

function recentRange(total, n) {
  const start = Math.max(1, total - n + 1);
  return `${start}:*`;
}

// Apply a triage action back to Gmail over the open IMAP connection (two-way
// sync). UID-based against the selected All Mail mailbox. Returns { ok, error? }.
async function applyModify(id, action) {
  if (!liveClient || !connected) return { ok: false, error: "bridge not connected" };
  const uid = uidById.get(id);
  if (!uid) return { ok: false, error: `unknown message id ${id}` };
  const range = String(uid);
  const opts = { uid: true };
  try {
    // imapflow STORE/MOVE RESOLVE FALSE on a rejected/no-op command (they don't
    // throw), so treat a falsy result as failure — otherwise the UI would think a
    // write landed in Gmail when it didn't.
    let ok = false;
    switch (action) {
      case "read":
        ok = await liveClient.messageFlagsAdd(range, ["\\Seen"], opts);
        break;
      case "unread":
        ok = await liveClient.messageFlagsRemove(range, ["\\Seen"], opts);
        break;
      case "star":
        ok = await liveClient.messageFlagsAdd(range, ["\\Flagged"], opts);
        break;
      case "unstar":
        ok = await liveClient.messageFlagsRemove(range, ["\\Flagged"], opts);
        break;
      case "trash":
        // Move out of All Mail into Trash = Gmail's restorable delete.
        // messageMove resolves to a map object on success, false on failure.
        ok = !!(await liveClient.messageMove(range, "[Gmail]/Trash", opts));
        if (ok) uidById.delete(id); // only forget the uid once it really moved
        break;
      case "archive":
        // Archive = remove the \Inbox Gmail label. Over IMAP that's an
        // X-GM-LABELS edit (Gmail X-GM-EXT-1); useLabels emits -X-GM-LABELS.
        // Returns false if rejected or X-GM-EXT-1 isn't negotiated.
        ok = await liveClient.messageFlagsRemove(range, ["\\Inbox"], { uid: true, useLabels: true });
        break;
      default:
        return { ok: false, error: `unknown action ${action}` };
    }
    return ok ? { ok: true } : { ok: false, error: `IMAP ${action} rejected` };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// ---- IMAP run loop (auto-reconnect) ----------------------------------------
async function run() {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: USER, pass: PASS },
    logger: false,
    emitLogs: false,
    // Break + restart IDLE well under Gmail's ~29-min limit so push stays alive.
    maxIdleTime: 5 * 60 * 1000,
  });

  client.on("error", (err) => console.error("[bridge] imap error:", err?.message || err));

  await client.connect();
  // mailboxOpen (not getMailboxLock): the documented "monitor a mailbox" pattern.
  // imapflow auto-starts IDLE on inactivity, so 'exists'/'flags' fire in realtime.
  await client.mailboxOpen(MAILBOX);
  connected = true;
  liveClient = client; // expose to the HTTP layer for /api/modify
  console.log(`[bridge] connected as ${USER} · mailbox "${MAILBOX}" · IDLE`);

  // Highest UID we've already pulled; new mail has uid > lastUid.
  let lastUid = Math.max(0, (client.mailbox.uidNext || 1) - 1);

  // Serialize our own fetches so handlers never overlap / race lastUid.
  let chain = Promise.resolve();
  const serialize = (fn) => {
    chain = chain.then(fn).catch((err) => console.error("[bridge]", err?.message || err));
    return chain;
  };

  try {
    const total = client.mailbox.exists || 0;
    const { emails: added, maxUid } = await fetchRange(client, recentRange(total, BACKFILL), {
      full: true,
    });
    if (maxUid > lastUid) lastUid = maxUid;
    ingest(added);
    broadcast("resync", snapshot());
    console.log(`[bridge] backfilled ${added.length} messages · ${mailbox.size} in mirror`);

    // Real-time: new mail (and your own sent mail) appended to All Mail. Fetch by
    // UID so a concurrent expunge can't shift sequence numbers under us.
    client.on("exists", () =>
      serialize(async () => {
        const { emails: fresh, maxUid: mu } = await fetchRange(client, `${lastUid + 1}:*`, {
          full: true,
          byUid: true,
        });
        if (mu > lastUid) lastUid = mu;
        const n = ingest(fresh);
        if (n) console.log(`[bridge] +${n} new (real-time)`);
      })
    );

    // Flag changes (read / star) — refresh recent state quickly.
    client.on("flags", () =>
      serialize(async () => {
        const t = client.mailbox.exists || 0;
        const { emails } = await fetchRange(client, recentRange(t, 60), { full: false });
        ingest(emails);
      })
    );

    // Safety-net reconcile: catch archives / label moves AND deletions/trashing
    // (which leave All Mail) that may not fire a usable event.
    const poll = setInterval(
      () =>
        serialize(async () => {
          const t = client.mailbox.exists || 0;
          const { emails } = await fetchRange(client, recentRange(t, Math.min(BACKFILL, 120)), {
            full: false,
          });
          reconcile(emails);
        }),
      POLL_MS
    );
    poll.unref?.();

    await new Promise((resolve) => {
      client.on("close", () => {
        clearInterval(poll);
        resolve();
      });
    });
  } finally {
    connected = false;
    liveClient = null;
  }
}

async function runForever() {
  for (;;) {
    try {
      await run();
    } catch (err) {
      console.error("[bridge] connection lost:", err?.message || err);
    }
    connected = false;
    liveClient = null;
    broadcast("hello", { account: USER }); // nudge clients; they'll re-pull state
    console.log("[bridge] reconnecting in 5s…");
    await new Promise((r) => setTimeout(r, 5000));
  }
}

// ---- on-demand full message (HTML + inline images + attachments) -----------
// Fetch the raw RFC822 for one message by hex id, via the live IMAP connection.
async function fetchRawSourceById(id) {
  if (!liveClient || !connected) return { error: "bridge not connected" };
  const uid = uidById.get(id);
  if (!uid) return { error: `unknown message id ${id}` };
  try {
    const msg = await liveClient.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
    if (!msg || !msg.source) return { error: "no source" };
    return { source: msg.source };
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

// Parse the raw source, inline cid: images as data: URIs, return a view payload.
// Computed per request and discarded after res.end — nothing is cached in the mirror.
async function buildMessageView(id) {
  const got = await fetchRawSourceById(id);
  if (got.error) return { error: got.error };
  let parsed;
  try {
    parsed = await simpleParser(got.source);
  } catch (err) {
    return { error: "parse failed: " + (err?.message || err) };
  }
  const atts = parsed.attachments || [];
  const cidMap = new Map();
  for (const a of atts) {
    if (a.cid && a.content && /^image\//i.test(a.contentType || "")) {
      const b64 = Buffer.from(a.content).toString("base64");
      cidMap.set(String(a.cid).replace(/^<|>$/g, ""), `data:${a.contentType};base64,${b64}`);
    }
  }
  let html = parsed.html || "";
  if (html && cidMap.size) {
    html = html
      .replace(/(src|background)\s*=\s*(["'])\s*cid:([^"'>\s]+)\s*\2/gi, (m, attr, q, cid) => {
        const d = cidMap.get(cid);
        return d ? `${attr}=${q}${d}${q}` : m;
      })
      .replace(/url\(\s*['"]?\s*cid:([^)'"\s]+)\s*['"]?\s*\)/gi, (m, cid) => {
        const d = cidMap.get(cid);
        return d ? `url('${d}')` : m;
      });
  }
  const attachments = atts.map((a, index) => ({
    filename: a.filename || `attachment-${index}`,
    contentType: a.contentType || "application/octet-stream",
    size: a.size ?? (a.content ? a.content.length : 0),
    cid: a.cid ? String(a.cid).replace(/^<|>$/g, "") : null,
    index,
    inline: !!(a.cid && a.related),
  }));
  return { id, html: html || "", text: parsed.text || "", attachments };
}

// ---- HTTP / SSE / static server --------------------------------------------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  // No wildcard CORS: the UI is served same-origin (dev goes through Vite's
  // server-side proxy), so a random website you visit can't read your mailbox.

  if (url.pathname === "/api/health") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ account: USER, connected, count: mailbox.size }));
    return;
  }

  // Real, human-triggered SMTP send. Called by the UI only after the undo-send
  // window elapses (see App.tsx tickOutbox). Sends as USER over Gmail SMTP.
  if (url.pathname === "/api/send" && req.method === "POST") {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 5_000_000) req.destroy(); // ~5MB guard
    });
    req.on("end", async () => {
      res.setHeader("Content-Type", "application/json");
      let payload;
      try {
        payload = JSON.parse(raw || "{}");
      } catch {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "invalid JSON" }));
        return;
      }
      const { to, cc, bcc, subject, body, inReplyTo, references } = payload;
      if (!to || !String(to).trim()) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "missing recipient (to)" }));
        return;
      }
      try {
        const info = await smtp.sendMail({
          from: USER,
          to,
          cc: cc || undefined,
          bcc: bcc || undefined,
          subject: subject || "",
          text: body || "",
          inReplyTo: inReplyTo || undefined,
          references: references || undefined,
        });
        console.log(`[bridge] /api/send -> ${info.messageId} (to ${String(to).slice(0, 60)})`);
        res.writeHead(200);
        res.end(JSON.stringify({ id: info.messageId }));
      } catch (err) {
        console.error("[bridge] /api/send failed:", err?.message || err);
        res.writeHead(502);
        res.end(JSON.stringify({ error: err?.message || "send failed" }));
      }
    });
    req.on("error", () => {
      try {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "request error" }));
      } catch {
        /* already closed */
      }
    });
    return;
  }

  // Two-way triage write-back to Gmail over IMAP.
  if (url.pathname === "/api/modify") {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 4096) req.destroy();
    });
    req.on("end", () => {
      void (async () => {
        let body;
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          body = {};
        }
        const id = String(body.id || "");
        const action = String(body.action || "");
        const ALLOWED = ["read", "unread", "star", "unstar", "trash", "archive"];
        if (!id || !ALLOWED.includes(action)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "bad request: need {id, action in " + ALLOWED.join("|") + "}" }));
          return;
        }
        const result = await applyModify(id, action);
        res.writeHead(result.ok ? 200 : 502, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
        if (result.ok) console.log(`[bridge] modify ${action} ${id} -> ok`);
        else console.error(`[bridge] modify ${action} ${id} -> ${result.error}`);
      })();
    });
    return;
  }

  if (url.pathname === "/api/state") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(snapshot()));
    return;
  }

  // On-demand full message: parse raw source, inline cid: images → JSON.
  // Loaded only when the user opens a message; never cached in the mirror.
  if (url.pathname === "/api/message") {
    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }
    const mid = url.searchParams.get("id") || "";
    if (!mid) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "missing id" }));
      return;
    }
    void (async () => {
      const view = await buildMessageView(mid);
      if (view.error) {
        res.writeHead(view.error.startsWith("unknown") ? 404 : 502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: view.error }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(view));
    })();
    return;
  }

  // On-demand raw attachment bytes, forced as a download (never rendered inline).
  if (url.pathname === "/api/attachment") {
    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "method not allowed" }));
      return;
    }
    const aid = url.searchParams.get("id") || "";
    const index = Number(url.searchParams.get("index"));
    if (!aid || !Number.isInteger(index) || index < 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "need id and integer index" }));
      return;
    }
    void (async () => {
      const got = await fetchRawSourceById(aid);
      if (got.error) {
        res.writeHead(got.error.startsWith("unknown") ? 404 : 502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: got.error }));
        return;
      }
      let parsed;
      try {
        parsed = await simpleParser(got.source);
      } catch {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "parse failed" }));
        return;
      }
      const a = (parsed.attachments || [])[index];
      if (!a || !a.content) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "attachment not found" }));
        return;
      }
      const buf = Buffer.from(a.content);
      // Strip CRLF/quotes (header-injection) + force download; rewrite html → octet-stream.
      const name = (a.filename || `attachment-${index}`).replace(/[\r\n"]/g, "_");
      const asciiName = name.replace(/[^\x20-\x7E]/g, "_");
      res.writeHead(200, {
        "Content-Type": /text\/html/i.test(a.contentType || "")
          ? "application/octet-stream"
          : a.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(buf);
    })();
    return;
  }

  if (url.pathname === "/api/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    res.write("retry: 3000\n\n");
    sseClients.add(res);
    sseSend(res, "hello", { account: USER });
    sseSend(res, "resync", snapshot());
    const ping = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        clearInterval(ping);
      }
    }, 25_000);
    req.on("close", () => {
      clearInterval(ping);
      sseClients.delete(res);
    });
    return;
  }

  // Unknown /api/* paths are real 404s (JSON). Everything else is the SPA.
  if (url.pathname.startsWith("/api/")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }
  serveStatic(req, res, url.pathname).catch(() => {
    try {
      res.writeHead(500);
      res.end();
    } catch {
      /* already closed */
    }
  });
});

// One clear line on a port clash instead of an uncaught crash-loop under launchd.
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`[bridge] port ${PORT} already in use — another bridge running? Exiting.`);
  } else {
    console.error("[bridge] http server error:", err?.message || err);
  }
  process.exit(1);
});

// Bind to loopback only so the mailbox is never reachable from the LAN — only
// this machine (the browser same-origin, and the dev Vite proxy) can connect.
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[bridge] http://localhost:${PORT}  (UI + /api/state · /api/stream · /api/health · /api/send · /api/modify · /api/message · /api/attachment)`);
  runForever();
});
