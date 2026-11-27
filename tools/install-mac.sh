#!/bin/bash
# NOTE: the placeholder in the download address is replaced by the access key of the download site when the script is deployed
# (see tools/site-serve.py). Do not write the placeholder anywhere else in this file.
# Installs Alternate Commander on macOS in one go:
#   curl -fsSL https://altcom.cc/install-mac.sh | bash
# Files downloaded by curl are not "quarantined", so macOS does not say "Commander is damaged". The script picks the build for your
# processor (Apple Silicon or Intel), copies the app into /Applications, signs it locally (needed on Apple Silicon) and starts it.
set -e

# the download site (it serves the images only to curl with this key)
BASE="https://altcom.cc/downloads"
case "$(uname -m)" in
  arm64) FILE="Alternate-Total-Commander-macOS-AppleSilicon.dmg" ;;
  *)     FILE="Alternate-Total-Commander-macOS-Intel.dmg" ;;
esac

TMP="$(mktemp -d)"
MNT="$TMP/mnt"
mkdir -p "$MNT"
cleanup() { hdiutil detach "$MNT" -quiet >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT
# Ctrl+C, a closed Terminal window and kill must remove the temporary files too: they end the script, which runs the line above
trap 'exit 130' INT
trap 'exit 129' HUP
trap 'exit 143' TERM

echo "Downloading $FILE ..."
if ! curl -fL --connect-timeout 15 --progress-bar -o "$TMP/app.dmg" "$BASE/$FILE?k=@MACKEY@"; then
  echo "The download from altcom.cc failed. Check the connection and run the command again." >&2
  exit 1
fi

echo "Installing into /Applications ..."
hdiutil attach -nobrowse -readonly -noverify -mountpoint "$MNT" "$TMP/app.dmg" >/dev/null
APP="$(ls -d "$MNT"/*.app 2>/dev/null | head -1)"
if [ -z "$APP" ]; then echo "The disk image has no application inside." >&2; exit 1; fi
NAME="$(basename "$APP")"

# stop a running copy and replace an old one (sudo is asked only if the normal way is not allowed)
RUNNING="/Applications/$NAME/Contents/MacOS/"
if pgrep -f "$RUNNING" >/dev/null 2>&1; then
  osascript -e 'with timeout of 10 seconds' -e "tell application \"${NAME%.app}\" to quit" -e 'end timeout' >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5; do pgrep -f "$RUNNING" >/dev/null 2>&1 || break; sleep 1; done
  # versions up to 0.1.935 could stay in memory after Quit: what is still there is ended
  pkill -9 -f "$RUNNING" >/dev/null 2>&1 || true
fi
rm -rf "/Applications/$NAME" 2>/dev/null || sudo rm -rf "/Applications/$NAME"
cp -R "$APP" /Applications/ 2>/dev/null || sudo cp -R "$APP" /Applications/

xattr -cr "/Applications/$NAME" 2>/dev/null || sudo xattr -cr "/Applications/$NAME"
codesign --force --deep --sign - "/Applications/$NAME" >/dev/null 2>&1 || echo "(local signing was skipped)"

echo "Done. Starting $NAME ..."
open "/Applications/$NAME"
