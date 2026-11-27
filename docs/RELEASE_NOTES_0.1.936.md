# Alternate Commander 0.1.936

Changes since 0.1.935: fixes from a test report.

## Quit and start
- The program no longer stays in memory after Quit while the file name index is working (seen on macOS).
- One running copy per settings folder: starting the program again shows the window that is already open, so two copies cannot overwrite each other's settings. A copy started with another `--user-data-dir` runs on its own as before.
- If the folder of the last session does not exist any more, the nearest folder above it is opened, without an error box.

## Archives with a password
- The password is checked as soon as the archive is opened. A wrong one is asked for again at once, not only when you copy a file.
- The viewer (F3) asks for the password too.

## macOS and Linux
- The Attr column shows the permissions of the file, such as `755`.
- macOS: Quick View and the tab keys are shown as Ctrl+Q and Ctrl+Tab (Cmd+Q and Cmd+Tab belong to the system), and the bottom button says Cmd+Q Exit.
- macOS: the startup disk is no longer listed twice, and long volume names are cut off in the drive button.
- Each package now contains only the 7-Zip of its own system, so the downloads for macOS and Linux are smaller.
- `install-mac.sh` removes its temporary files when it is interrupted, and can replace a running copy that does not quit.

## Languages
- Translated: the free space line, texts of the viewer, and the usual questions with file names (copy, move, delete, pack, unpack, password).
- Dates are written the way of the chosen language.

## Download and update
The program updates itself (Configuration > Check for Updates). All files are at https://altcom.cc
