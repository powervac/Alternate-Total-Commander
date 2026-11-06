'use strict';
// About (the last item of the menu bar): the version of this program, the newest version on the download server, the links and "Check for updates".
// Uses helpers from app.js (openModal, modalCount, esc, api) and filetools.js (checkForUpdates).

const ABOUT_LINKS = {
  site: 'https://total.gieldowa.keenetic.link',
  mirror: 'https://nem68.duckdns.org',
  git: 'https://github.com/powervac/Alternate-Total-Commander',
};

async function openAbout() {
  if (modalCount > 0) return;
  const box = document.createElement('div');
  box.className = 'dlg about';
  box.innerHTML =
    '<div class="dlg-title">About</div><div class="dlg-body">' +
    '<div class="ab-name">Alternate Total Commander</div>' +
    '<div class="ab-sub">A two-panel file manager for Windows and macOS, in the manner of Total Commander.</div>' +
    '<div class="ab-ver">Version <b class="ab-cur">...</b></div>' +
    '<div class="ab-state">Looking for the newest version ...</div>' +
    '<div class="ab-links">' +
    `<div><span>Website</span><a href="#" data-u="${ABOUT_LINKS.site}">${ABOUT_LINKS.site.replace('https://', '')}</a></div>` +
    `<div><span>Fast mirror</span><a href="#" data-u="${ABOUT_LINKS.mirror}">${ABOUT_LINKS.mirror.replace('https://', '')}</a></div>` +
    `<div><span>Source code</span><a href="#" data-u="${ABOUT_LINKS.git}">github.com/powervac/Alternate-Total-Commander</a></div>` +
    '</div>' +
    '<div class="ab-credit">The ZX Spectrum emulator is Unreal Speccy Portable (GPL-3.0). The interface font is Inter.</div>' +
    '</div><div class="dlg-btns"><button class="ab-check primary">Check for updates</button><button class="ab-close">Close</button></div>';
  const q = (s) => box.querySelector(s);
  const close = openModal(box);
  box.querySelectorAll('.ab-links a').forEach((a) => (a.onclick = (e) => { e.preventDefault(); api.openUrl(a.dataset.u); }));
  q('.ab-close').onclick = () => close();
  q('.ab-check').onclick = () => { close(); setTimeout(() => checkForUpdates(false), 50); }; // the usual question with "Update now"
  box.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } });
  box.tabIndex = -1;
  box.focus();

  const r = await api.updateCheck();
  if (!box.isConnected) return;
  q('.ab-cur').textContent = r.current || '?';
  const st = q('.ab-state');
  if (r.error) st.textContent = 'The newest version could not be checked: ' + r.error;
  else if (r.newer) { st.textContent = `Version ${r.latest} is available.`; st.classList.add('new'); }
  else st.textContent = `This is the newest version (${r.latest}).`;
  if (r.info && r.info.notes) { const n = document.createElement('div'); n.className = 'ab-notes'; n.textContent = (r.newer ? 'What is new: ' : 'Last release: ') + r.info.notes; st.after(n); }
}
