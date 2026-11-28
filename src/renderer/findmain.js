'use strict';
// Start of the Find Files window: the context from the main window (folders of the panels, selected files ...), then the search dialog fills the window.

(async () => {
  FIND_CTX = (await api.findContext()) || FIND_CTX;
  const title = () => { document.title = FIND_CTX.server ? 'Find Files - ' + FIND_CTX.server.name : 'Find Files'; };
  title();
  openSearch();
  // the main window opened the search again while this window exists: a fresh context (the folders of the panels may have changed)
  const of = (c) => (c && c.server ? c.server.id : '');
  api.onFindContext((ctx) => {
    // from a server to the disks (or to another server) the window is built anew; a running scan is not thrown away
    if (ctx && of(ctx) !== of(FIND_CTX)) { if (!window.FIND_BUSY) location.reload(); return; }
    FIND_CTX = ctx || FIND_CTX; const dir = document.querySelector('.s-dir'); if (dir && !dir.value.trim()) dir.value = FIND_CTX.dir || '';
  });
})();
