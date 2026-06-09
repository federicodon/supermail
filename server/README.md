# SuperMail live sync bridge

Real-time, **read-only** Gmail → SuperMail mirror. Keeps one IMAP connection
open with **IDLE** on `[Gmail]/All Mail`, so Gmail pushes new mail the moment it
arrives; the bridge normalizes it to SuperMail's `Email` shape and streams it to
the browser over SSE.

```
Gmail  ──IMAP IDLE──▶  server/index.mjs  ──SSE──▶  SuperMail UI
```

## Run

```bash
# .env.local must contain GMAIL_USER + GMAIL_APP_PASSWORD (see ../.env.example)
npm run sync     # bridge only
npm run live     # bridge + UI together
```

## HTTP surface (proxied to the UI at /api/* via vite.config.ts)

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | `{ account, connected, count }` |
| `GET /api/state` | full snapshot `{ account, emails, labels, … }` |
| `GET /api/stream` | SSE: `hello`, `resync` (full), `upsert` (changed), `expunge` |

## Files

- `index.mjs` — IMAP connection + IDLE loop (auto-reconnect), in-memory mirror,
  HTTP/SSE server.
- `lib/normalize.mjs` — Gmail message → `Email`. Two entry points (REST/MCP and
  IMAP+mailparser); shared by the snapshot generator (`../tools/build-live-snapshot.mjs`).
- `launch.mjs` — `npm run live`: runs Vite + the bridge with prefixed output.

## Safety

This module speaks **IMAP only**. There is no SMTP client and no send path —
nothing here can send mail or change your account. Credentials come from a local,
git-ignored env file and are never logged. Sending stays permanently disabled,
consistent with the rest of SuperMail.

## Notes

- Stable ids: uses Gmail `X-GM-MSGID`/`X-GM-THRID` (hex), the same id space as the
  REST API and the snapshot, so live updates merge cleanly with local triage.
- `pino` (imapflow's logger) is pinned to v8 via `overrides` so the bridge runs on
  Node 18 as well as 20+.
