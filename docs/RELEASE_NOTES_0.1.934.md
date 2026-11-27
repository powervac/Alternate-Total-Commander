# Alternate Commander 0.1.934

Changes since 0.1.933.

## New

### Drive and favorites bar
A row of buttons above each panel, asked for by a user who knows it from Double Commander. Switch it on with **Show > Drive / Favorites Bar** (it is off by default).

- Buttons for the disks, **..** (up one level), the home folder and your own favorite folders.
- Short labels of your choice: two or three letters are enough (UD for User Documents, NM for Network Media).
- Every favorite has a description; hold the mouse over the button to see the description and the full path.
- **+** adds the folder that is open. The right mouse button adds, edits, removes and moves favorites, or hides the bar.
- Paths may use `~`, `$HOME`, `$NAME`, `${NAME}` and `%NAME%`, so one entry such as `$HOME/Documents` keeps working when the user name differs.
- Network folders (`\\server\share`) work on Windows. Favorites on cloud drives and servers remember their connection.
- The same favorites are listed in the drive list (Alt+F1 / Alt+F2), and the button of the open folder is highlighted.
- Windows, macOS and Linux keep separate lists. The lists are part of Settings sync.

### Dark mode
**Configuration > Dark Mode: On / Off / System** (also in Configuration > Display).

- **System** follows the setting of the operating system and changes together with it.
- The theme applies to all windows of the program, including dialogs and Find Files.
- The default stays light: nothing changes until you switch it on.

### Italian
The interface and the whole built-in help are now available in Italian (**Configuration > Language... > Italiano**). The program now speaks nine languages: English, Russian, Ukrainian, Belarusian, Polish, Portuguese, Spanish, German and Italian.

### Encrypted archives
Opening an encrypted zip, 7z or rar archive now asks for its password. The password is remembered until you close the program.

## Improved

### Synology NAS in the local network
When you connected with a QuickConnect ID, the program could use the QuickConnect relay even though the NAS was in the same network, so files travelled at the speed of the internet connection.

- Addresses are now tried in this order: **local network**, then **direct over the internet**, and the **QuickConnect relay** only when nothing else answers.
- The line above the NAS panel shows which way the connection goes.
- With "Allow an untrusted certificate", a bare local address is used only after the device there confirms that it is your NAS, so the password is not sent to another device in a foreign network.
- Developer mode lists the addresses that were tried and the one that was chosen.

Reconnect to the NAS after the update: the way is chosen when the connection is made. If the panel does not show "local network", enter the local address with the port (for example `192.168.1.20:5001`) or allow the untrusted certificate for this connection.

## Fixed
- Dialogs that open in their own windows (settings, copy, favorites and others) stayed in English in every language. They are now translated.

## Help
- A new part about the drive and favorites bar and a note about dark mode, in all nine languages.

## Download and update
The program offers the update by itself (**Configuration > Check for Updates...**). New installations: https://altcom.cc
