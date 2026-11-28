'use strict';
// Net > Server File Database...: the Find Files window for the server in the active panel (the same as Alt+F7 there). The window builds
// the database and searches it (search.js); the work is done in main/remotecatalog.js. Uses helpers from app.js (A, msg, modalCount).

function openCatalog() {
  if (modalCount > 0) return;
  const panel = A();
  if (!panel.rem) {
    return msg('Server File Database', 'Open a server in the active panel first: a Synology NAS, SSH, FTP, WebDAV, Dropbox or Google Drive.\nDisks of this computer, also network drives with a letter, are indexed in Configuration > File index.');
  }
  openServerSearch(panel);
}
