'use strict';
// SSH console (xterm.js) for SFTP panels. A panel with an SSH connection can show the console or the file list (Ctrl+O).
// Files copied (F5) into a panel that shows the console, or dropped onto it, are uploaded to the console's current directory.
// Uses helpers from app.js (panels, A, P, api, msg, esc) and the upload code there (doUpload).

const termMap = new Map(); // connection id -> { term, fit, host, cwd, started, opened }

/** one line typed into the remote shell: makes it print the current directory (OSC 7) before every prompt */
const SSH_HOOK = [
  " __cmdr_cwd(){ printf '\\033]7;file://%s%s\\033\\\\' \"${HOSTNAME:-host}\" \"$PWD\"; }",
  '; if [ -n "$BASH_VERSION" ]; then PROMPT_COMMAND="__cmdr_cwd${PROMPT_COMMAND:+;$PROMPT_COMMAND}"',
  '; elif [ -n "$ZSH_VERSION" ]; then precmd_functions+=(__cmdr_cwd)',
  "; else PS1='$(__cmdr_cwd)'\"$PS1\"; fi; clear\r",
].join('');

function sshTerminal(rem) {
  let t = termMap.get(rem.id);
  if (t) return t;
  const host = document.createElement('div');
  host.className = 'term-host';
  const term = new Terminal({
    fontFamily: 'Consolas, "SF Mono", Menlo, "Courier New", monospace',
    fontSize: 13,
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: true,
    theme: { background: '#0c0c0c', foreground: '#cccccc' },
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  t = { id: rem.id, term, fit, host, cwd: '', started: false, opened: false };
  termMap.set(rem.id, t);
  term.onData((d) => api.sshWrite({ id: rem.id, data: d }));
  term.onResize(({ cols, rows }) => api.sshResize({ id: rem.id, cols, rows }));
  // the shell reports its directory with OSC 7: file://host/path
  term.parser.registerOscHandler(7, (data) => {
    const m = /^file:\/\/[^/]*(\/.*)$/.exec(data);
    if (m) {
      try { t.cwd = decodeURIComponent(m[1]); } catch { t.cwd = m[1]; }
      sshStatus(rem.id);
    }
    return true;
  });
  return t;
}

/** directory uploads go to: the console's current directory, else the file list's folder */
function sshCwd(panel) {
  const t = termMap.get(panel.rem.id);
  return t && t.cwd ? t.cwd : panel.rem.path;
}

function sshStatus(id) {
  const t = termMap.get(id);
  for (const p of panels) {
    if (p.rem && p.rem.id === id && p.consoleOn) p.$status.textContent = `Console ${p.rem.name}:${t && t.cwd ? t.cwd : '~'}   (files copied here are uploaded to this folder)`;
  }
}

async function sshShowConsole(panel) {
  if (!panel.rem || panel.rem.type !== 'sftp') return;
  const t = sshTerminal(panel.rem);
  // only one panel shows a given console at a time
  for (const q of panels) if (q !== panel && q.consoleOn && q.rem && q.rem.id === panel.rem.id) sshShowList(q);
  panel.$term.innerHTML = '';
  panel.$term.appendChild(t.host);
  panel.el.classList.add('console');
  panel.consoleOn = true;
  if (!t.opened) { t.term.open(t.host); t.opened = true; }
  if (!panel.$term.dataset.bound) {
    panel.$term.dataset.bound = '1';
    panel.$term.addEventListener('mousedown', () => panel.focus());
    new ResizeObserver(() => { const x = panel.rem && termMap.get(panel.rem.id); if (x && panel.consoleOn && panel.$term.clientWidth > 20) { try { x.fit.fit(); } catch { /* hidden */ } } }).observe(panel.$term);
    // drop files from the OS onto the console: upload them
    panel.$term.addEventListener('dragover', (e) => { e.preventDefault(); panel.$term.classList.add('drop'); });
    panel.$term.addEventListener('dragleave', () => panel.$term.classList.remove('drop'));
    panel.$term.addEventListener('drop', (e) => {
      e.preventDefault();
      panel.$term.classList.remove('drop');
      const paths = [...e.dataTransfer.files].map((f) => api.pathForFile(f)).filter(Boolean);
      if (paths.length) doUpload(panel, paths.map((abs) => ({ name: P.basename(abs), abs })), 'copy');
    });
  }
  panel.focus();
  await new Promise((r) => requestAnimationFrame(r));
  try { t.fit.fit(); } catch { /* not visible yet */ }
  if (!t.started) {
    t.started = true;
    const r = await api.sshShell({ id: panel.rem.id, cols: t.term.cols, rows: t.term.rows });
    if (r.error) t.term.write(`\r\n\x1b[31m${r.error}\x1b[0m\r\n`);
    else {
      setTimeout(() => api.sshWrite({ id: panel.rem.id, data: SSH_HOOK }), 250);
      // a server that never answers the shell request would leave a black, silent window
      setTimeout(() => {
        if (!t.gotData) t.term.write('\r\n\x1b[33m[Commander] The server has not sent anything yet. Press Enter; if nothing appears, the server may not allow an interactive shell for this account (use Ctrl+O for the file list).\x1b[0m\r\n');
      }, 5000);
    }
  }
  sshStatus(panel.rem.id);
  t.term.focus();
}

function sshShowList(panel) {
  panel.el.classList.remove('console');
  panel.consoleOn = false;
  if (document.activeElement && panel.$term.contains(document.activeElement)) document.activeElement.blur();
  panel.updateStatus();
}

/** Ctrl+O */
function sshToggleConsole(panel = A()) {
  if (!panel.rem || panel.rem.type !== 'sftp') {
    // not an SSH panel: use the other one when it is, else explain how to connect
    const other = panels.find((q) => q !== panel && q.rem && q.rem.type === 'sftp');
    if (other) return sshToggleConsole(other);
    return msg('SSH', 'This panel is not connected to an SSH server.\n\nPress Ctrl+Shift+F (Net > SSH server...), enter the host, user and password (or a key file) and press Connect.\nAfter that Ctrl+O switches between the console and the file list.');
  }
  if (panel.consoleOn) {
    sshShowList(panel);
    // the file list opens in the folder the console is in
    const t = termMap.get(panel.rem.id);
    if (t && t.cwd && t.cwd !== panel.rem.path) panel.loadRem(panel.rem, t.cwd, { push: true });
  } else sshShowConsole(panel);
}

/** a line of our own in the console (not sent to the server) */
function sshNote(id, text) {
  const t = termMap.get(id);
  if (t && t.opened) t.term.write(`\r\n\x1b[32m[Commander] ${text}\x1b[0m\r\n`);
}

function sshDispose(id) {
  const t = termMap.get(id);
  if (!t) return;
  for (const p of panels) if (p.rem && p.rem.id === id && p.consoleOn) sshShowList(p);
  try { t.term.dispose(); } catch { /* already gone */ }
  termMap.delete(id);
}

// data from the server -> terminal
api.onSshData((p) => {
  const t = termMap.get(p.id);
  if (t) {
    t.gotData = true;
    t.term.write(p.data instanceof Uint8Array ? p.data : new Uint8Array(p.data));
  }
});
api.onSshClosed(async (p) => {
  const t = termMap.get(p.id);
  if (t) t.term.write('\r\n\x1b[33m[connection closed]\x1b[0m\r\n');
  if (p.connection) {
    liveConns.delete(p.id);
    // the whole connection is gone: leave the panels that used it
    for (const q of panels) if (q.rem && q.rem.id === p.id) { sshShowList(q); await q.load(q.lastLocal || api.home); }
    msg('SSH', 'The connection was closed by the server.');
  } else if (t) t.started = false; // only the shell ended: it is started again next time
});
