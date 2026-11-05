#!/bin/bash
# Double-click launcher for macOS (first run once: chmod +x start-mac.command)
cd "$(dirname "$0")" || exit 1
unset ELECTRON_RUN_AS_NODE
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required: https://nodejs.org  (or: brew install node)"
  read -r -p "Press Enter to close"
  exit 1
fi
[ -d node_modules ] || npm install
exec npx electron .
