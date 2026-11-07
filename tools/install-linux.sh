#!/bin/bash
# Installs Alternate Commander on Linux (x86_64) in one go:
#   curl -fsSL https://altcom.cc/install-linux.sh | bash
# The AppImage goes to ~/Applications/Commander.AppImage, an entry is added to the application menu, and the program starts.
# The program updates itself later (Configuration > Check for Updates).
set -e

# the download site
BASES="https://altcom.cc"
FILE="Alternate-Total-Commander-Linux.AppImage"
if [ "$(uname -m)" != "x86_64" ]; then echo "Only 64-bit Intel/AMD (x86_64) is built for Linux." >&2; exit 1; fi

DIR="$HOME/Applications"
DEST="$DIR/Commander.AppImage"
mkdir -p "$DIR"
TMP="$(mktemp "$DIR/.Commander.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

echo "Downloading $FILE ..."
GOT=""
for BASE in $BASES; do
  if curl -fL --connect-timeout 15 --progress-bar -o "$TMP" "$BASE/downloads/$FILE"; then
    # the checksum of latest.json (when python3 is there) tells a damaged download from a good one
    SHA="$(curl -fsS --connect-timeout 15 "$BASE/latest.json" 2>/dev/null | python3 -c 'import json,sys; print((json.load(sys.stdin).get("linux") or {}).get("sha256",""))' 2>/dev/null || true)"
    if [ -z "$SHA" ] || [ "$(sha256sum "$TMP" | cut -c1-64)" = "$SHA" ]; then GOT=1; break; fi
    echo "The file is damaged, trying the next server ..." >&2
  else
    echo "That server did not give the file, trying the next one ..." >&2
  fi
done
if [ -z "$GOT" ]; then echo "The download failed on both servers." >&2; exit 1; fi

chmod 755 "$TMP"
mv -f "$TMP" "$DEST"
trap - EXIT

# menu entry
APPS="$HOME/.local/share/applications"
mkdir -p "$APPS"
cat > "$APPS/alternate-total-commander.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Alternate Commander
Comment=Two-panel file manager
Exec="$DEST" %U
Terminal=false
Categories=Utility;FileManager;
EOF

# some systems need FUSE for AppImages: tell how to get it when the program does not start
echo "Done: $DEST"
echo "(If it does not start: sudo apt install libfuse2   or run it with --appimage-extract-and-run)"
nohup "$DEST" >/dev/null 2>&1 &
