#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Community Kanban — one-click start (macOS)
#
# Double-click this file. It installs what's needed the first time, asks you a
# few setup questions, then starts the app and opens it in your browser.
#
# FIRST TIME: right-click this file → Open, to clear the macOS "unidentified
# developer" warning. After that a normal double-click works.
#
# To stop the app: close this window, or press Ctrl+C in it.
# ─────────────────────────────────────────────────────────────────────────────

# Work in the folder this file sits in, wherever that ended up.
cd "$(dirname "$0")" || exit 1

# macOS tags anything unzipped from a download as quarantined, and refuses to
# launch it by double-click — the "Apple could not verify..." dialog, which on
# current macOS has no "Open Anyway" button at all. Running this file from a
# Terminal works regardless, so if we got here we can clear the flag for the
# whole folder. That makes this and its sibling .command files double-clickable
# from now on, instead of needing the dance once per file.
xattr -dr com.apple.quarantine . 2>/dev/null

MIN_NODE=22

say()  { printf '\n  %s\n' "$1"; }
fail() { printf '\n  %s\n\n  This window stays open so you can read it.\n' "$1"; read -r -p "  Press Return to close. "; exit 1; }

printf '\n  ┌──────────────────────────────────────────┐'
printf '\n  │   Community Kanban                       │'
printf '\n  └──────────────────────────────────────────┘\n'

# ── 1. Node ──────────────────────────────────────────────────────────────────
# Installers put node in /usr/local/bin or /opt/homebrew/bin; a double-clicked
# .command doesn't always inherit a shell profile that has those on PATH.
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  say "Node isn't installed yet — that's the engine this app runs on."
  say "Opening nodejs.org. Download the big green LTS button, run the"
  say "installer with all the defaults, then double-click this file again."
  open "https://nodejs.org" 2>/dev/null
  fail "Nothing else on your Mac changes when you install it."
fi

NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt "$MIN_NODE" ]; then
  say "Your Node is $(node -v), and this needs v$MIN_NODE or newer."
  say "Opening nodejs.org — install the LTS version over the top of the old"
  say "one, then double-click this file again."
  open "https://nodejs.org" 2>/dev/null
  fail "Installing the new one replaces the old; nothing to uninstall first."
fi

# ── 2. Dependencies ──────────────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  say "First run — fetching what the app needs. Takes a few seconds."
  npm install --no-audit --no-fund || fail "That didn't finish. Are you online?"
fi

# ── 3. Setup ─────────────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  say "Let's set it up. A few quick questions:"
  printf '\n'
  npm run --silent setup || fail "Setup didn't finish — run this file again to retry."
  [ -f .env ] || fail "Setup didn't write its config. Run this file again."

  # An empty table teaches nobody anything. Offer something to look at.
  printf '\n'
  say "Load five sample parts so you can see how it works?"
  say "They're all labelled SAMPLE, and you can clear them out later."
  read -r -p "  Load them? [Y/n] " LOAD_SAMPLES
  case "$LOAD_SAMPLES" in
    [Nn]*) say "Skipped. You can load them any time by running: npm run seed:sample" ;;
    *)     npm run --silent seed:sample || say "Couldn't load the samples — not to worry, the app still works." ;;
  esac
fi

# ── 4. Start, and open the browser once it's listening ───────────────────────
PORT=$(grep -E '^PORT=' .env 2>/dev/null | head -1 | cut -d= -f2 | tr -d '[:space:]')
[ -z "$PORT" ] && PORT=8080

(
  # Wait for the port to answer rather than guessing at a sleep, so the browser
  # doesn't open on a connection-refused page.
  for _ in $(seq 1 40); do
    if curl -s -o /dev/null "http://localhost:$PORT/login"; then
      open "http://localhost:$PORT" 2>/dev/null
      exit 0
    fi
    sleep 0.25
  done
) &

say "Starting. Your browser will open in a moment."
say "Leave this window open while you use the app — closing it stops the app."
printf '\n'
npm run --silent dev

# Only reached if the server stops on its own.
fail "The app stopped."
