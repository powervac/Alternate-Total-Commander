# Alternate Commander 0.1.940

Changes since 0.1.939.

## QNAP and UGREEN
- New items in the Net menu: **QNAP NAS...** and **UGREEN NAS...**. They connect through WebDAV, which has to be turned on on the NAS. Each window tells where to do that and keeps its own list of connections; your other WebDAV connections stay where they were.
- A new section in the help, in all nine languages.
- They have not been tried with a real QNAP or UGREEN device yet: reports are welcome.

## Fixed
- An upload to a WebDAV server or a Synology NAS could hang at 0 % when the local file could not be read, for example a Dropbox or OneDrive file that is kept only in the cloud. Now it ends with an error, which says what to do. The uploads to Dropbox and Google Drive got the same fix.

## Download and update
The program updates itself (Configuration > Check for Updates). All files are at https://altcom.cc
