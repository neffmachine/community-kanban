#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Community Kanban — stop running in the background (macOS)
#
# Double-click this to stop the app and keep it from starting at login. Your
# data is untouched: it stays in the database file, and you can start the app
# again any time with "Start Community Kanban.command".
# ─────────────────────────────────────────────────────────────────────────────
LABEL="com.communitykanban.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

printf '\n  Stopping Community Kanban…\n'
launchctl bootout "gui/$UID/$LABEL" 2>/dev/null || launchctl unload "$PLIST" 2>/dev/null
rm -f "$PLIST"

if launchctl print "gui/$UID/$LABEL" >/dev/null 2>&1; then
  printf '\n  It is still registered. Try restarting the Mac.\n\n'
else
  printf '\n  ✓ Stopped, and it will not start at login any more.\n'
  printf '  Your data is untouched.\n\n'
fi
read -r -p "  Press Return to close. "
