# Alternate Commander 0.1.943

Changes since 0.1.942.

## Connect at start and stay connected
A new box in the connection windows: **Connect when the program starts and keep connected** (it needs the saved login). The server is connected after every start, checked about once a minute and connected again after a break. A refused login, or a NAS that asks for a 2-step code, is not tried again by itself; the drive list shows why. After a manual disconnect the server is left alone.

## Server File Database: Feed to listbox
All found files (up to 20,000) go into the panel as one list: view them, open them and copy them to this computer with F5 (files with the same name get a number). Deleting and moving are not possible in that list.

## Fixed
- The top of a server no longer has a ".." line. It led out of the server into some local folder; leave a server through the drive list or Net > Disconnect.
- A server that could not be reached was sometimes taken for connected, when the error came without a text.
- macOS: protection against a drive selection that hangs when a disk does not answer. (The cause of the reported hang has not been confirmed on a Mac.)

## Download and update
The program updates itself (Configuration > Check for Updates). All files are at https://altcom.cc
