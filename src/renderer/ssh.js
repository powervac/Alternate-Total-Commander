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
    sshRefreshFiles(t); // the prompt follows: remember what is in this folder (for dragging names out of the output)
    return true;
  });
  return t;
}

/** names in the console's folder, so a file name in the output can be recognised and dragged out */
async function sshRefreshFiles(t) {
  const path = t.cwd || t.startPath;
  if (!path) return;
  const r = await api.nasList({ id: t.id, path }).catch(() => null);
  if (r && !r.error && path === (t.cwd || t.startPath)) t.files = new Map(r.items.map((i) => [i.name, i]));
}

/** the file name under the mouse in the console output (only names that exist in the console's folder), or null */
function sshNameAt(t, e) {
  const screen = t.host.querySelector('.xterm-screen');
  if (!screen || !t.files || !t.files.size) return null;
  const r = screen.getBoundingClientRect();
  const col = Math.floor((e.clientX - r.left) / (r.width / t.term.cols));
  const row = Math.floor((e.clientY - r.top) / (r.height / t.term.rows));
  if (col < 0 || row < 0 || col >= t.term.cols || row >= t.term.rows) return null;
  const line = t.term.buffer.active.getLine(t.term.buffer.active.viewportY + row);
  if (!line) return null;
  const text = line.translateToString(false);
  if (!text[col] || /\s/.test(text[col])) return null;
  let a = col, b = col;
  while (a > 0 && !/\s/.test(text[a - 1])) a--;
  while (b < text.length - 1 && !/\s/.test(text[b + 1])) b++;
  let w = text.slice(a, b + 1);
  const cands = [w, w.replace(/['"]/g, ''), w.replace(/[*\/@=|]$/, ''), w.replace(/['"]/g, '').replace(/[*\/@=|]$/, '')];
  const name = cands.find((c) => t.files.has(c));
  return name ? t.files.get(name) : null;
}

/** grab a file name in the console output and drop it on the other panel: copies the file there */
function sshDragStart(panel, e) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || !panel.rem) return;
  const t = termMap.get(panel.rem.id);
  const item = t && sshNameAt(t, e);
  if (!item) return;
  e.stopPropagation();
  e.preventDefault();
  panel.focus();
  t.term.focus();
  const sx = e.clientX, sy = e.clientY;
  let ghost = null, over = null;
  const target = (ev) => {
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const q = panels.find((x) => x !== panel && el && x.el.contains(el));
    return q || null;
  };
  const mark = (q) => { if (over !== q) { if (over) over.el.classList.remove('dragover'); over = q; if (q) q.el.classList.add('dragover'); } };
  const move = (ev) => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = (item.isDir ? '\u{1F4C1} ' : '') + item.name;
      document.body.appendChild(ghost);
    }
    ghost.style.left = ev.clientX + 12 + 'px';
    ghost.style.top = ev.clientY + 12 + 'px';
    mark(target(ev));
  };
  const up = async (ev) => {
    document.removeEventListener('mousemove', move, true);
    document.removeEventListener('mouseup', up, true);
    if (!ghost) return;
    ghost.remove();
    const q = target(ev);
    mark(null);
    if (q) await sshDragDownload(panel, q, item);
  };
  document.addEventListener('mousemove', move, true);
  document.addEventListener('mouseup', up, true);
}

/** copy one file/folder from the console's folder into the folder shown in the panel dst */
async function sshDragDownload(src, dst, item) {
  if (dst.rem || dst.arc) return msg('SSH', 'Drop the file on a panel that shows a local folder.');
  const base = sshCwd(src);
  const destDir = dst.dir;
  const conflicts = await api.conflicts({ sources: [item.name], destDir, rename: null });
  let overwrite = 'skip';
  if (conflicts.length) {
    const c = await dialog({
      title: 'Confirm overwrite',
      text: `"${item.name}" already exists in ${destDir}`,
      buttons: [
        { label: 'Overwrite', value: 'all', primary: true },
        { label: 'Skip existing', value: 'skip' },
        { label: 'Cancel', value: 'cancel', cancel: true },
      ],
    });
    if (c.value === 'cancel') return;
    overwrite = c.value;
  }
  const res = await withProgress('Copying', (jobId) =>
    api.nasDownload({ id: src.rem.id, jobId, base, destDir, overwrite, items: [{ name: item.name, isDir: item.isDir, size: item.size, mtime: item.mtime }] })
  );
  if (res.error) res.errors = [res.error];
  await Promise.all(panels.map((p) => p.refresh()));
  if (res.errors && res.errors.length) await showErrors(res.errors);
  else if (!res.cancelled) sshNote(src.rem.id, `"${item.name}" copied to ${destDir}`);
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
  if (panel.$mode) panel.$mode.value = 'console';
  if (!t.opened) { t.term.open(t.host); t.opened = true; }
  if (!panel.$term.dataset.bound) {
    panel.$term.dataset.bound = '1';
    panel.$term.addEventListener('mousedown', () => panel.focus());
    panel.$term.addEventListener('mousedown', (e) => sshDragStart(panel, e), true); // capture: before xterm starts a text selection
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
  if (!panel.rem) return; // disconnected while the console was opening
  t.startPath = panel.rem.path;
  sshRefreshFiles(t);
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
  if (panel.$mode) panel.$mode.value = 'files';
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

/** the picklist next to "SSH / SFTP": 'console' or 'files' */
function sshSetMode(panel, mode) {
  if (!panel.rem || panel.rem.type !== 'sftp') return;
  if ((mode === 'console') !== panel.consoleOn) sshToggleConsole(panel);
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
