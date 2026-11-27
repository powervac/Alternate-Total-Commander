# Alternate Commander 0.1.942

Changes since 0.1.941.

## Fixed: pictures with a .HEIC name that are not HEIC
Some files called .HEIC are really JPEG pictures (edited iPhone photos and files from sync tools can be like that). Windows showed their thumbnails, but the viewer said the file was damaged.

- The format is now recognised by the content, not by the name: viewer, quick view and thumbnails show such files. Converting one to JPG copies it unchanged.
- For a HEIC file that the built-in decoder cannot read, the system's codec and FFmpeg are tried too. If nothing works, the message says what is inside the file.

## The built-in viewer is the default
- Enter and a double click open pictures, video, PDF and text files in the built-in viewer (office documents opened there already). Music still goes to the player, archives open as folders, and programs, scripts, shortcuts and web pages are opened by the system as before.
- **Files > Open With Default Application** uses the program of the system. The new box "Enter and double click open pictures, video, PDF and text in the built-in viewer" in the settings turns this off.

## Download and update
The program updates itself (Configuration > Check for Updates). All files are at https://altcom.cc
