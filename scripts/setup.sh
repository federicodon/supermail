#!/usr/bin/env bash
# SuperMail one-command setup — designed to be run by a human OR a local agent
# (Codex / Claude Code) on the machine where the mail client will live.
#
#   bash scripts/setup.sh                # full setup (interactive only if
#                                        #   credentials are missing)
#   bash scripts/setup.sh --foreground   # run the bridge with nohup instead of
#                                        #   installing the macOS LaunchAgent
#   bash scripts/setup.sh --no-open      # never open browser pages
#
# What it does, idempotently:
#   1. checks Node >= 18
#   2. npm install (if needed) + production build
#   3. ensures .env.local has GMAIL_USER + GMAIL_APP_PASSWORD
#      (prompts interactively if missing — the ONLY human moment, because the
#       App Password must be created while logged into the user's Google
#       account: https://myaccount.google.com/apppasswords)
#   4. starts the sync bridge — on macOS as a LaunchAgent (auto-starts on
#      login, restarts on crash), elsewhere via nohup
#   5. verifies REAL Gmail sync via /api/health (connected + message count)
#   6. prints the two remaining clicks to load the Chrome extension
#
# Exit codes: 0 = synced and serving; 1 = something needs attention (the
# script says exactly what). Safe to re-run any time.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PORT="${BRIDGE_PORT:-8787}"
OPEN_PAGES=1
USE_LAUNCHAGENT=1
for arg in "$@"; do
  case "$arg" in
    --no-open) OPEN_PAGES=0 ;;
    --foreground|--no-launchagent) USE_LAUNCHAGENT=0 ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done
IS_MAC=0; [ "$(uname -s)" = "Darwin" ] && IS_MAC=1
[ "$IS_MAC" = 1 ] || USE_LAUNCHAGENT=0

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
open_url() { [ "$OPEN_PAGES" = 1 ] && [ "$IS_MAC" = 1 ] && open "$1" >/dev/null 2>&1 || true; }

step "1/6 · Node"
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js not found. Install Node 18+ (e.g. 'brew install node') and re-run."
  exit 1
fi
NODE_BIN="$(command -v node)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node $(node -v) found; 18+ required."
  exit 1
fi
ok "node $(node -v) at $NODE_BIN"

step "2/6 · Install + build"
if [ ! -d node_modules ]; then
  npm install --no-fund --no-audit || { fail "npm install failed"; exit 1; }
  ok "dependencies installed"
else
  ok "dependencies present (delete node_modules to force reinstall)"
fi
npm run build >/dev/null 2>&1 || { fail "build failed — run 'npm run build' to see why"; exit 1; }
ok "UI built into dist/"

step "3/6 · Gmail credentials (.env.local)"
has_env() { [ -f .env.local ] && grep -q "^GMAIL_USER=..*" .env.local && grep -q "^GMAIL_APP_PASSWORD=..*" .env.local; }
if has_env; then
  ok ".env.local already configured for $(grep '^GMAIL_USER=' .env.local | cut -d= -f2)"
else
  if [ ! -t 0 ]; then
    fail ".env.local is missing GMAIL_USER / GMAIL_APP_PASSWORD and stdin is not a terminal."
    echo "    Create an App Password (Google account → 2-Step Verification on):"
    echo "      https://myaccount.google.com/apppasswords   (choose type: Mail)"
    echo "    Then write supermail/.env.local:"
    echo "      GMAIL_USER=you@yourdomain.com"
    echo "      GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx"
    echo "    and re-run this script."
    exit 1
  fi
  echo "  An App Password lets SuperMail sync over IMAP/SMTP without your real password."
  echo "  Requirements: 2-Step Verification ON; on Google Workspace the admin must allow"
  echo "  IMAP + App Passwords (Gmail → Settings → Forwarding and POP/IMAP → enable IMAP)."
  open_url "https://myaccount.google.com/apppasswords"
  echo "  → Create one now (type: Mail): https://myaccount.google.com/apppasswords"
  printf '  Gmail address: '
  read -r GUSER
  printf '  App Password (16 chars, input hidden): '
  read -rs GPASS
  echo
  GPASS="$(printf '%s' "$GPASS" | tr -d '[:space:]')"
  if [ -z "$GUSER" ] || [ ${#GPASS} -lt 16 ]; then
    fail "Need both an address and the 16-character App Password."
    exit 1
  fi
  { echo "GMAIL_USER=$GUSER"; echo "GMAIL_APP_PASSWORD=$GPASS"; } > .env.local
  chmod 600 .env.local
  ok ".env.local written (git-ignored, never leaves this machine)"
fi

step "4/6 · Start the sync bridge"
if [ "$USE_LAUNCHAGENT" = 1 ]; then
  PLIST="$HOME/Library/LaunchAgents/com.supermail.bridge.plist"
  LOG="$HOME/Library/Logs/supermail-bridge.log"
  mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
  cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.supermail.bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$ROOT/server/index.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST_EOF
  launchctl bootout "gui/$(id -u)/com.supermail.bridge" >/dev/null 2>&1 || true
  if launchctl bootstrap "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || launchctl load -w "$PLIST" >/dev/null 2>&1; then
    ok "LaunchAgent installed — starts on login, restarts on crash (log: $LOG)"
  else
    warn "launchctl refused the agent; falling back to a foreground process"
    USE_LAUNCHAGENT=0
  fi
fi
if [ "$USE_LAUNCHAGENT" = 0 ]; then
  if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    ok "a bridge is already answering on :$PORT (leaving it)"
  else
    mkdir -p "$ROOT/.logs"
    nohup "$NODE_BIN" "$ROOT/server/index.mjs" >> "$ROOT/.logs/bridge.log" 2>&1 &
    ok "bridge started in background (log: .logs/bridge.log)"
  fi
fi

step "5/6 · Verify real Gmail sync"
HEALTH=""
for i in $(seq 1 30); do
  HEALTH="$(curl -sf "http://127.0.0.1:$PORT/api/health" 2>/dev/null || true)"
  if [ -n "$HEALTH" ] && printf '%s' "$HEALTH" | grep -q '"connected":true'; then break; fi
  sleep 2
done
if [ -z "$HEALTH" ]; then
  fail "the bridge is not answering on http://localhost:$PORT"
  echo "    Check the log ($([ "$IS_MAC" = 1 ] && echo "$HOME/Library/Logs/supermail-bridge.log" || echo .logs/bridge.log)) — most common: missing/typo'd .env.local."
  exit 1
fi
if printf '%s' "$HEALTH" | grep -q '"connected":true'; then
  ACCOUNT="$(printf '%s' "$HEALTH" | sed -n 's/.*"account":"\([^"]*\)".*/\1/p')"
  COUNT="$(printf '%s' "$HEALTH" | sed -n 's/.*"count":\([0-9]*\).*/\1/p')"
  ok "LIVE — synced with $ACCOUNT ($COUNT messages mirrored)"
else
  fail "bridge is up but NOT connected to Gmail yet"
  echo "    Health says: $HEALTH"
  echo "    Usual causes, in order:"
  echo "      1. App Password wrong / revoked → make a new one and update .env.local"
  echo "      2. IMAP disabled → Gmail → Settings → Forwarding and POP/IMAP → Enable IMAP"
  echo "      3. Workspace policy blocks IMAP or App Passwords → Google Admin console"
  echo "    Fix, then re-run: bash scripts/setup.sh"
  exit 1
fi

step "6/6 · Chrome extension (two clicks remain — Chrome doesn't allow scripting this)"
echo "    1. Open chrome://extensions  → toggle 'Developer mode' (top right)"
echo "    2. 'Load unpacked' → select: $ROOT/extension"
echo "    Then ⌘⇧M from any tab opens SuperMail. Or just bookmark http://localhost:$PORT"
open_url "http://localhost:$PORT"
open_url "chrome://extensions"

printf '\n\033[1m⚡ SuperMail is live at http://localhost:%s — synced, always-on, one keystroke away.\033[0m\n' "$PORT"
echo "   The loop: j/k → Enter (open) → Enter (reply) → ⌘J (dictate, Enter writes) → ⌘↵ (send)."
