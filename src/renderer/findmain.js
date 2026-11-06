'use strict';
// Start of the Find Files window: the context from the main window (folders of the panels, selected files ...), then the search dialog fills the window.

(async () => {
  FIND_CTX = (await api.findContext()) || FIND_CTX;
  document.title = 'Find Files';
  openSearch();
  // the main window opened the search again while this window exists: a fresh context (the folders of the panels may have changed)
  api.onFindContext((ctx) => { FIND_CTX = ctx || FIND_CTX; const dir = document.querySelector('.s-dir'); if (dir && !dir.value.trim()) dir.value = FIND_CTX.dir || ''; });
})();
