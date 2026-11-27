# Alternate Commander 0.1.935

Changes since 0.1.934: the rest of the request about the drive and favorites bar.

## Icons for favorites
- Every favorite can have an icon: 18 built-in ones (folder, home, documents, downloads, pictures, music, video, desktop, drive, USB, network, server, cloud, code, game, star, temporary, trash).
- Or your own picture (**Image file...**: PNG, SVG, ICO, JPG), for example one of the icon theme in `/usr/share/icons` on Linux. It is made small and kept with the favorite, so it travels with Settings sync and the .ini file.
- With an icon the label may stay empty: a button with the icon only.
- The icons are also shown in the drive list (Alt+F1 / Alt+F2).

## Import and export as .ini
Right-click the bar: **Export to .ini...** saves the list (for example as `drivefavorites.ini`), **Import from .ini...** adds it to your list or replaces the list. Entries you already have are not doubled. The file is easy to write by hand:

```ini
[Favorite1]
Label=UD
Name=User Documents
Path=$HOME/Documents
Icon=documents

[Favorite2]
Label=NM
Name=Network Media
Path=\\server\media
Icon=network
```
