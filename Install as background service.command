#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Community Kanban — run it in the background, always (macOS)
#
# Double-click this once. After that the app starts when this Mac logs in,
# restarts itself if it ever crashes, and keeps running with no window open.
#
# FIRST TIME: right-click this file → Open, to clear the macOS "unidentified
# developer" warning.
#
# To stop it again, double-click "Uninstall background service.command".
# ─────────────────────────────────────────────────────────────────────────────
cd "$(dirname "$0")" || exit 1

# macOS tags anything unzipped from a download as quarantined, and refuses to
# launch it by double-click — the "Apple could not verify..." dialog, which on
# current macOS has no "Open Anyway" button at all. Running this file from a
# Terminal works regardless, so if we got here we can clear the flag for the
# whole folder. That makes this and its sibling .command files double-clickable
# from now on, instead of needing the dance once per file.
xattr -dr com.apple.quarantine . 2>/dev/null

LABEL="com.communitykanban.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/CommunityKanban.log"

say()  { printf '\n  %s\n' "$1"; }
fail() { printf '\n  %s\n\n' "$1"; read -r -p "  Press Return to close. "; exit 1; }

printf '\n  ┌──────────────────────────────────────────┐'
printf '\n  │   Community Kanban — background service  │'
printf '\n  └──────────────────────────────────────────┘\n'

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
NODE="$(command -v node)"
[ -z "$NODE" ] && fail "Node isn't installed. Run 'Start Community Kanban.command' first."

# launchd starts this with a bare environment, so everything must be absolute.
APP_DIR="$(pwd -P)"
[ -f "$APP_DIR/server.mjs" ] || fail "Can't find the app. Keep this file inside the app folder."
[ -f "$APP_DIR/.env" ] || fail "Not set up yet. Run 'Start Community Kanban.command' first."
[ -d "$APP_DIR/node_modules" ] || fail "Not installed yet. Run 'Start Community Kanban.command' first."

PORT=$(grep -E '^PORT=' "$APP_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2 | tr -d '[:space:]')
[ -z "$PORT" ] && PORT=8080

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>--env-file=$APP_DIR/.env</string>
    <string>$APP_DIR/server.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>$APP_DIR</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST_EOF

# Replace any previous copy, then start it.
launchctl bootout "gui/$UID/$LABEL" 2>/dev/null
launchctl bootstrap "gui/$UID" "$PLIST" 2>/dev/null || launchctl load "$PLIST" 2>/dev/null

say "Waiting for it to come up…"
for _ in $(seq 1 40); do
  if curl -s -o /dev/null "http://localhost:$PORT/login"; then
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
    printf '\n  ✓ Running, and it will keep running.\n'
    printf '\n    On this Mac:        http://localhost:%s\n' "$PORT"
    [ -n "$IP" ] && printf '    From the shop wifi: http://%s:%s\n' "$IP" "$PORT"
    printf '\n  It starts again by itself when this Mac restarts, and if it ever\n'
    printf '  crashes. You can close this window — the app keeps going.\n'
    printf '\n  Log: %s\n' "$LOG"
    printf '  To stop it: double-click "Uninstall background service.command"\n\n'
    read -r -p "  Press Return to close. "
    exit 0
  fi
  sleep 0.25
done

fail "It didn't start. Check the log for why: $LOG"
