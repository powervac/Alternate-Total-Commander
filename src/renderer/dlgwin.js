'use strict';
// Dialogs in windows of their own (like in Total Commander): a dialog can be taken out of the program window and put anywhere on the screen.
// The dialog's elements are moved into a small window (window.open) of the same page: the code of the dialog keeps working, only its place changes.
// The window is modal for the one it was opened from. Configuration > Display > "Open dialogs in their own windows" switches this off.

let dlgSeq = 0;
const dlgStack = []; // the popups that are open now (the newest is the last): a dialog opened from a dialog belongs to it

/** -> the function that closes the dialog, or null when a window could not be opened (the dialog then stays in the page) */
function dlgPopup(box) {
  if (window.FIND_WINDOW) return null;
  const host = dlgStack.length ? dlgStack[dlgStack.length - 1].win : window;
  let pw = null;
  try {
    const W = 640, H = 420;
    const left = Math.round(host.screenX + (host.outerWidth - W) / 2), top = Math.round(host.screenY + (host.outerHeight - H) / 3);
    pw = host.open('about:blank', 'cmdr-dialog-' + (++dlgSeq), `width=${W},height=${H},left=${left},top=${top}`); // a name of its own: the same name would reuse the window that has it
  } catch { pw = null; }
  if (!pw) return null;
  const title = (box.querySelector('.dlg-title') || {}).textContent || 'Commander';
  const doc = pw.document;
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8"><title></title></head><body class="dlg-window"></body></html>');
  doc.close();
  doc.title = title;
  const loaded = [];
  for (const l of document.querySelectorAll('link[rel=stylesheet]')) {
    const c = doc.createElement('link');
    c.rel = 'stylesheet';
    loaded.push(new Promise((res) => { c.onload = c.onerror = res; }));
    c.href = l.href;
    doc.head.appendChild(c);
  }
  const node = doc.adoptNode(box);
  doc.body.appendChild(node);
  modalCount++;

  const entry = { win: pw };
  dlgStack.push(entry);
  // the window takes the size of the dialog (and follows it when the dialog grows or shrinks)
  let lastFit = null;
  var userSized = false;
  const fit = () => {
    if (userSized) return;
    try {
      box.style.maxHeight =Math.max(200, screen.availHeight - 80) + 'px'; // taller than the screen: the middle of the dialog scrolls, the buttons stay
      const r = box.getBoundingClientRect(); // fractions of a pixel count: the window is a whole pixel larger, so that no scroll bar can appear
      const w = Math.ceil(r.width) + 1, h = Math.ceil(r.height) + 1;
      if (!r.width || !r.height) return;
      if (lastFit && lastFit.w === w && lastFit.h === h) return; // nothing changed: do not touch the window (no feedback between the window and the dialog)
      lastFit = { w, h };
      if (pw.api && pw.api.winFit) pw.api.winFit({ w, h }); // the window's own api: it sets the size of the content
      else pw.resizeTo(w + 16, h + 39);
    } catch { /* the window is gone */ }
  };
  let ro = null;
  try { ro = new pw.ResizeObserver(() => fit()); ro.observe(box); } catch { ro = null; }
  // the user drags the edge of the window: the dialog follows the window (from then on the window keeps the size the user gave it)
  const stretch = () => {
    if (!userSized) return;
    box.style.setProperty('width', pw.innerWidth + 'px', 'important');
    box.style.setProperty('height', pw.innerHeight + 'px', 'important');
    box.style.setProperty('max-width', 'none', 'important');
    box.style.setProperty('max-height', 'none', 'important');
    box.style.boxSizing = 'border-box';
    box.style.overflow = 'auto';
  };
  try {
    pw.addEventListener('resize', () => {
      if (done) return;
      if (!userSized) {
        if (!lastFit || (Math.abs(pw.innerWidth - lastFit.w) <= 3 && Math.abs(pw.innerHeight - lastFit.h) <= 3)) return; // our own fit, not the user
        if (pw.innerWidth < lastFit.w - 3 || pw.innerHeight < lastFit.h - 3) { /* smaller than the dialog: it scrolls */ }
        userSized = true;
        if (ro) ro.disconnect();
      }
      stretch();
    });
  } catch { /* ignore */ }
  // the real size is known when the style sheets and the font are there; a few more fits catch late changes
  Promise.all(loaded).then(() => { setTimeout(fit, 30); try { doc.fonts.ready.then(() => setTimeout(fit, 30)); } catch { /* old engine */ } setTimeout(fit, 250); setTimeout(fit, 700); });
  try { pw.focus(); } catch { /* ignore */ }

  var done = false;
  let poll = null;
  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(poll);
    const i = dlgStack.indexOf(entry);
    if (i >= 0) dlgStack.splice(i, 1);
    try { if (ro) ro.disconnect(); } catch { /* ignore */ }
    try { box.remove(); } catch { /* ignore */ }
    try { pw.close(); } catch { /* ignore */ }
    modalCount--;
    try { window.focus(); } catch { /* ignore */ }
  };
  // the window was closed with its own X: that is "Cancel" (Escape) for the dialog
  poll = setInterval(() => {
    if (done || !pw.closed) return;
    try { box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); } catch { /* ignore */ }
    finish();
  }, 200);
  return finish;
}

// ---------------------------------------------------------------- developer mode (About > Developer mode): lines go to the log window of the main process
const devLog = (tag, text) => { try { if (store.get('devMode', false)) api.devLog(tag, text); } catch { /* ignore */ } };
window.addEventListener('error', (e) => devLog('error', `${e.message} at ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => devLog('error', 'unhandled: ' + ((e.reason && e.reason.stack) || e.reason)));
setTimeout(() => { try { api.devSet(!!store.get('devMode', false)); } catch { /* ignore */ } }, 600);
