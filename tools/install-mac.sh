#!/bin/bash
# NOTE: @MACKEY@ is replaced by the access key of the download site when the script is deployed (see tools/site-serve.py).
# Installs Alternate Total Commander on macOS in one go:
#   curl -fsSL https://total.gieldowa.keenetic.link/install-mac.sh | bash
# Files downloaded by curl are not "quarantined", so macOS does not say "Commander is damaged". The script picks the build for your
# processor (Apple Silicon or Intel), copies the app into /Applications, signs it locally (needed on Apple Silicon) and starts it.
set -e

BASE="https://total.gieldowa.keenetic.link/downloads"
case "$(uname -m)" in
  arm64) FILE="Alternate-Total-Commander-macOS-AppleSilicon.dmg" ;;
  *)     FILE="Alternate-Total-Commander-macOS-Intel.dmg" ;;
esac

TMP="$(mktemp -d)"
MNT="$TMP/mnt"
mkdir -p "$MNT"
cleanup() { hdiutil detach "$MNT" -quiet >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT

echo "Downloading $FILE ..."
curl -fL --progress-bar -o "$TMP/app.dmg" "$BASE/$FILE?k=@MACKEY@"

echo "Installing into /Applications ..."
hdiutil attach -nobrowse -readonly -noverify -mountpoint "$MNT" "$TMP/app.dmg" >/dev/null
APP="$(ls -d "$MNT"/*.app 2>/dev/null | head -1)"
if [ -z "$APP" ]; then echo "The disk image has no application inside." >&2; exit 1; fi
NAME="$(basename "$APP")"

# stop a running copy and replace an old one (sudo is asked only if the normal way is not allowed)
osascript -e "tell application \"${NAME%.app}\" to quit" >/dev/null 2>&1 || true
rm -rf "/Applications/$NAME" 2>/dev/null || sudo rm -rf "/Applications/$NAME"
cp -R "$APP" /Applications/ 2>/dev/null || sudo cp -R "$APP" /Applications/

xattr -cr "/Applications/$NAME" 2>/dev/null || sudo xattr -cr "/Applications/$NAME"
codesign --force --deep --sign - "/Applications/$NAME" >/dev/null 2>&1 || echo "(local signing was skipped)"

echo "Done. Starting $NAME ..."
open "/Applications/$NAME"
