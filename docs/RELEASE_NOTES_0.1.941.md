# Alternate Commander 0.1.941

Changes since 0.1.940.

## One panel and panel widths
- **Show > One Panel (Full Width)** (Ctrl+Shift+P, or the toolbar button) shows only the active panel, made for looking through thumbnails. Tab or the ⇄ button shows the other one. The hidden panel keeps its folder: F5 and F6 still go there, and the path can be changed. Quick view shows both panels while it is on.
- The border between the panels can be dragged. A double click makes them equal.

## Thumbnails
- A slider at the bottom of the panel (or Ctrl + mouse wheel) changes the size of the thumbnails. Bigger ones are loaded sharper. Each panel keeps its own size.
- The thumbnails stand close to each other.

## HEIC photos
- The viewer, quick view and thumbnails show HEIC / HEIF pictures.
- **Files > Convert HEIC / JPG...** converts HEIC to JPG, and JPG or PNG to HEIC, with a quality setting. Existing files are not overwritten. EXIF data and the colour profile are kept when HEIC is read and, on Windows and Linux, when it is written (on macOS the system's own converter writes the HEIC).
- Reading uses libheif (LGPL-3.0, the libheif-js package). HEIC files are written with the bundled FFmpeg on Windows and Linux and with `sips` on macOS. The new files have not been tried in Apple Photos on an iPhone yet.

## File database of a server
- **Net > Server File Database...** (or Alt+F7 on a panel with a server) scans a Synology NAS, SSH, FTP, WebDAV, Dropbox or Google Drive once and remembers names, sizes and dates. Searches then answer at once, and **Go to file** opens the folder of the file. Text inside files is not searched. It has not been tried with a real big NAS yet. Network drives with a letter are indexed as before in Configuration > File index.

## macOS and the local network
- The Mac package now declares that it uses the local network, and says what to switch on if macOS does not let the program reach a NAS there. This is not a fix for slow copying from a Synology NAS: on the Mac that was checked, the connection already went through the local network, and the cause of the slowness is not known yet.

## Download and update
The program updates itself (Configuration > Check for Updates). All files are at https://altcom.cc
