'use strict';
// About (the last item of the menu bar) and the update dialog in one window: the version of this program, the links, "Check for updates" with a spinner,
// the answer ("you have X, the newest is Y") and an "Update" button that downloads and installs without leaving the window.
// Uses helpers from app.js (openModal, modalCount, esc, api, store) and filetools.js (ftBytes).

const ABOUT_LINKS = {
  site: 'https://altcom.cc',
  git: 'https://github.com/powervac/Alternate-Total-Commander',
};

/**
 * opts.check: start the check at once (Configuration > Check for Updates)
 * opts.result: a check result that is already known (the quiet check at start found a new version); then "Skip this version" is offered too
 */
async function openAbout(opts = {}) {
  if (modalCount > 0) return;
  const box = document.createElement('div');
  box.className = 'dlg about';
  box.innerHTML =
    '<div class="dlg-title">About</div><div class="dlg-body">' +
    '<div class="ab-name">Alternate Commander</div>' +
    '<div class="ab-sub">A two-panel file manager for Windows and macOS, in the manner of Total Commander.</div>' +
    '<div class="ab-ver">Your version: <b class="ab-cur">...</b></div>' +
    '<div class="ab-status"><span class="ab-spin" hidden></span><span class="ab-state"></span></div>' +
    '<div class="bar ab-bar" hidden><i></i></div>' +
    '<div class="ab-notes" hidden></div>' +
    '<div class="ab-links">' +
    `<div><span>Website</span><a href="#" data-u="${ABOUT_LINKS.site}">${ABOUT_LINKS.site.replace('https://', '')}</a></div>` +
    `<div><span>Source code</span><a href="#" data-u="${ABOUT_LINKS.git}">github.com/powervac/Alternate-Total-Commander</a></div>` +
    '</div>' +
    '<label class="ab-dev"><input type="checkbox" class="ab-devmode"> Developer mode (a window with the detailed log opens during sync, updates and archive work)</label>' +
    '<div class="ab-credit">The ZX Spectrum emulator is Unreal Speccy Portable (GPL-3.0). The interface font is Inter.</div>' +
    '</div><div class="dlg-btns"><button class="ab-update primary" hidden>Update</button><button class="ab-check">Check for updates</button><button class="ab-skip" hidden>Skip this version</button><button class="ab-close">Close</button></div>';
  const q = (s) => box.querySelector(s);
  const close = openModal(box);
  q('.ab-devmode').checked = !!store.get('devMode', false);
  q('.ab-devmode').onchange = (e) => { store.set('devMode', e.target.checked); api.devSet(e.target.checked); };
  let busy = false;
  let last = null; // the last check result
  box.querySelectorAll('.ab-links a').forEach((a) => (a.onclick = (e) => { e.preventDefault(); api.openUrl(a.dataset.u); }));

  const setBusy = (on, text) => {
    busy = on;
    q('.ab-spin').hidden = !on;
    q('.ab-check').disabled = on;
    q('.ab-update').disabled = on;
    q('.ab-skip').disabled = on;
    q('.ab-close').disabled = on; // the window stays while it works
    if (text !== undefined) { q('.ab-state').textContent = text; q('.ab-state').className = 'ab-state'; }
  };
  const showResult = (r) => {
    last = r;
    q('.ab-cur').textContent = r.current || '?';
    const st = q('.ab-state');
    const notes = q('.ab-notes');
    notes.hidden = true;
    q('.ab-update').hidden = true;
    q('.ab-skip').hidden = true;
    if (r.error) { st.textContent = 'The newest version could not be checked: ' + r.error; st.className = 'ab-state bad'; return; }
    if (r.newer) {
      st.textContent = `You have version ${r.current}, the new version is ${r.latest}.`;
      st.className = 'ab-state new';
      q('.ab-update').hidden = false;
      q('.ab-update').textContent = r.platform === 'darwin' ? 'Update' : 'Download update';
      if (opts.result) q('.ab-skip').hidden = false;
      q('.ab-update').focus();
    } else {
      st.textContent = `You have version ${r.current}, this is the newest version.`;
      st.className = 'ab-state ok';
    }
    if (r.info && r.info.notes) { notes.textContent = (r.newer ? 'What is new: ' : 'Last release: ') + r.info.notes; notes.hidden = false; }
  };

  async function check() {
    if (busy) return;
    setBusy(true, 'Checking for updates ...');
    q('.ab-update').hidden = true;
    q('.ab-skip').hidden = true;
    q('.ab-notes').hidden = true;
    q('.ab-bar').hidden = true;
    const [r] = await Promise.all([api.updateCheck(), new Promise((res) => setTimeout(res, 700))]); // the spinner is visible at least a moment
    if (!box.isConnected) return;
    setBusy(false);
    showResult(r);
  }

  async function install() {
    if (busy || !last || !last.newer) return;
    const how = last.platform === 'darwin' ? 'Starting the installation ...' : 'Downloading the update ...';
    setBusy(true, how);
    const bar = q('.ab-bar');
    bar.hidden = false;
    bar.firstElementChild.style.width = '0%';
    const off = api.onUpdateProgress((p) => {
      if (!p.total) return;
      const pct = Math.floor((p.done / p.total) * 100);
      bar.firstElementChild.style.width = pct + '%';
      q('.ab-state').textContent = `Downloading the update ... ${pct} %  (${ftBytes(p.done)} of ${ftBytes(p.total)})`;
    });
    const res = await api.updateInstall({ info: last.info });
    off();
    if (!box.isConnected) return;
    if (res.error) { setBusy(false); bar.hidden = true; q('.ab-state').textContent = 'The update failed: ' + res.error; q('.ab-state').className = 'ab-state bad'; return; }
    if (res.saved) {
      setBusy(false);
      bar.hidden = true;
      q('.ab-state').textContent = `The program is now a single portable exe, so it cannot replace this copy. The new version was saved here: ${res.saved}. Close this program and run that file; your settings, passwords and keys are copied at its first start.`;
      q('.ab-state').className = 'ab-state ok';
      return;
    }
    bar.firstElementChild.style.width = '100%';
    q('.ab-state').textContent = res.terminal ? 'Follow the Terminal window: it installs the new version.' : 'The update is installed: the program restarts ...';
    q('.ab-state').className = 'ab-state ok';
    if (res.terminal) { setBusy(false); q('.ab-update').hidden = true; }
    // otherwise the program quits by itself and the new one starts: the window stays until then
  }

  q('.ab-check').onclick = check;
  q('.ab-update').onclick = install;
  q('.ab-skip').onclick = () => { if (last && last.latest) store.set('updateSkip', last.latest); close(); };
  q('.ab-close').onclick = () => { if (!busy) close(); };
  box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' && !busy) { e.preventDefault(); close(); } });
  box.tabIndex = -1;
  box.focus();

  // the version of this program is known at once; the rest after "Check for updates"
  if (opts.result) showResult(opts.result);
  else if (opts.check) check();
  else api.appVersion().then((v) => { if (box.isConnected && !last) q('.ab-cur').textContent = v; });
}
