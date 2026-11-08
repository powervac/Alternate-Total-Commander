'use strict';
// Help (About > Help, F1): a window with a table of contents, a search that highlights what it finds, and the text in the language of the
// interface. The texts are in src/renderer/help/<lang>.js (HELP_TEXT[lang] = { ui, sections }); a section that a language does not have yet is
// shown in English. Section ids are the same in every language, links inside the text use them: <a href="#" data-go="ssh">.
// The section with the keyboard shortcuts is built here from the command list of hotkeys.js, so it shows the keys that are set now.
// Uses helpers from app.js (openModal, esc, api, tr/LANG from i18n.js, HK_COMMANDS/hkLabel from hotkeys.js).

const HELP_TEXT = {};
const HELP_ORDER = ['start', 'panels', 'select', 'ops', 'archives', 'search', 'viewer', 'media', 'nas', 'ssh', 'ftp', 'cloud', 'sync', 'tools', 'extras', 'keys', 'config', 'platforms', 'security', 'trouble', 'about'];
let helpWin = null; // the open window: { box, go(id), focusSearch() }

/** the text of one language, with English behind it for everything that is missing */
function helpData() {
  const en = HELP_TEXT.en || { ui: {}, sections: [] };
  const my = (LANG !== 'en' && HELP_TEXT[LANG]) || en;
  const ui = Object.assign({}, en.ui, my.ui);
  const byId = (d) => new Map((d.sections || []).map((s) => [s.id, s]));
  const e = byId(en);
  const m = byId(my);
  const sections = HELP_ORDER.map((id) => {
    const s = m.get(id) || e.get(id) || { id, t: id, h: '' };
    return { id, t: s.t || (e.get(id) || {}).t || id, h: s.h !== undefined ? s.h : (e.get(id) || {}).h || '' };
  });
  return { ui, sections };
}

/** the keyboard section: every command of the program with its keys as they are set now */
function helpKeysHtml(ui) {
  const groups = new Map();
  for (const c of HK_COMMANDS) {
    if (!groups.has(c[1])) groups.set(c[1], []);
    groups.get(c[1]).push(c);
  }
  let h = `<p>${esc(ui.keysIntro || '')}</p>`;
  for (const [g, list] of groups) {
    h += `<h3>${esc(tr(g))}</h3><table class="hk">`;
    for (const c of list) {
      const keys = (typeof hkLabel === 'function' ? hkLabel(c[0]) : c[3].join(', ')) || '-';
      h += `<tr><td>${esc(tr(c[2]))}</td><td>${esc(keys)}</td></tr>`;
    }
    h += '</table>';
  }
  return h + `<p class="help-note">${esc(ui.keysFoot || '')}</p>`;
}

const helpPlain = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').toLowerCase();

/** wrap every occurrence of q in the text nodes of root with <mark> */
function helpMark(root, q) {
  if (!q) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.nodeValue.toLowerCase().includes(q)) hits.push(n);
  let count = 0;
  for (const n of hits) {
    const text = n.nodeValue;
    const low = text.toLowerCase();
    const frag = document.createDocumentFragment();
    let i = 0;
    for (let at = low.indexOf(q); at >= 0; at = low.indexOf(q, i)) {
      frag.appendChild(document.createTextNode(text.slice(i, at)));
      const m = document.createElement('mark');
      m.textContent = text.slice(at, at + q.length);
      frag.appendChild(m);
      i = at + q.length;
      count++;
    }
    frag.appendChild(document.createTextNode(text.slice(i)));
    n.parentNode.replaceChild(frag, n);
  }
  return count;
}

/** the text files of English and of the current language, loaded once, when the help is opened for the first time */
function helpLoad() {
  const need = ['en', ...(LANG !== 'en' ? [LANG] : [])].filter((l) => !HELP_TEXT[l]);
  return Promise.all(need.map((l) => new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'help/' + l + '.js';
    s.onload = s.onerror = res;
    document.head.appendChild(s);
  })));
}

let helpOpening = false;
/** About > Help, F1. id: the section to open first */
async function openHelp(id) {
  if (helpOpening) return;
  helpOpening = true;
  try { await helpLoad(); } finally { helpOpening = false; }
  if (helpWin && helpWin.box.isConnected) { if (id) helpWin.go(id); return; } // already open (a window that was closed with its X is gone from the page)
  if (modalCount > 0) return;
  const { ui, sections } = helpData();
  for (const s of sections) {
    if (s.id === 'keys') s.h = ''; // built every time the section is shown
    s.txt = s.id === 'keys' ? '' : helpPlain(s.t + ' ' + s.h);
  }
  const box = document.createElement('div');
  box.className = 'dlg help-win';
  box.innerHTML =
    `<div class="dlg-title">${esc(ui.title || 'Help')}</div>` +
    '<div class="help-wrap"><div class="help-side">' +
    `<input class="help-search" type="search" spellcheck="false" autocomplete="off" placeholder="${esc(ui.search || 'Search')}" aria-label="${esc(ui.search || 'Search')}">` +
    '<div class="help-toc" tabindex="0"></div></div>' +
    '<div class="help-main" tabindex="0"></div></div>' +
    `<div class="dlg-btns"><span class="help-hint">${esc(ui.hint || '')}</span><button class="help-close primary">${esc(ui.close || 'Close')}</button></div>`;
  const q = (s) => box.querySelector(s);
  const toc = q('.help-toc'), main = q('.help-main'), search = q('.help-search');
  let cur = (sections.find((s) => s.id === id) || sections[0]).id;
  let query = '';
  let close = null;

  const body = (s) => (s.id === 'keys' ? helpKeysHtml(ui) : s.h);
  function paint() {
    const list = query ? sections.filter((s) => s.id === 'keys' ? helpPlain(helpKeysHtml(ui)).includes(query) || s.t.toLowerCase().includes(query) : s.txt.includes(query)) : sections;
    toc.innerHTML = list.map((s) => `<a href="#" data-id="${s.id}" class="${!query && s.id === cur ? 'on' : ''}">${esc(s.t)}</a>`).join('') || `<div class="help-none">${esc(ui.none || '')}</div>`;
    if (!query) {
      const s = sections.find((x) => x.id === cur);
      main.innerHTML = `<h2>${esc(s.t)}</h2>${body(s)}`;
    } else {
      main.innerHTML = list.length
        ? `<div class="help-count"></div>` + list.map((s) => `<section class="help-hit" data-id="${s.id}"><h2>${esc(s.t)}</h2>${body(s)}</section>`).join('')
        : `<p class="help-none">${esc(ui.none || '')}</p>`;
      const n = helpMark(main, query);
      const c = main.querySelector('.help-count');
      if (c) c.textContent = (ui.found || '{n}').replace('{n}', n).replace('{s}', list.length);
      const first = main.querySelector('mark');
      if (first) first.scrollIntoView({ block: 'center' });
    }
    if (!query) main.scrollTop = 0;
    const on = toc.querySelector('a.on');
    if (on) on.scrollIntoView({ block: 'nearest' });
  }
  const go = (sid) => {
    if (!sections.some((s) => s.id === sid)) return;
    cur = sid;
    if (query) { query = ''; search.value = ''; }
    paint();
  };

  toc.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-id]');
    if (!a) return;
    e.preventDefault();
    if (query) { const sec = main.querySelector(`.help-hit[data-id="${a.dataset.id}"]`); if (sec) sec.scrollIntoView({ block: 'start' }); } else go(a.dataset.id);
  });
  main.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    if (a.dataset.go) go(a.dataset.go);
    else if (a.dataset.u) api.openUrl(a.dataset.u);
  });
  search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); paint(); });
  box.addEventListener('keydown', (e) => {
    const k = e.key;
    if (k === 'Escape') {
      e.preventDefault();
      if (query) { query = ''; search.value = ''; paint(); } else close();
    } else if ((e.ctrlKey || e.metaKey) && keyLetter(e) === 'f' || (k === '/' && e.target !== search)) {
      e.preventDefault();
      search.focus();
      search.select();
    } else if ((k === 'ArrowDown' || k === 'ArrowUp') && !query && e.target !== main) {
      const i = sections.findIndex((s) => s.id === cur) + (k === 'ArrowDown' ? 1 : -1);
      if (i >= 0 && i < sections.length) { e.preventDefault(); go(sections[i].id); if (e.target === search) search.focus(); }
    } else if (k === 'PageDown' || k === 'PageUp') {
      e.preventDefault();
      main.scrollBy({ top: (k === 'PageDown' ? 1 : -1) * main.clientHeight * 0.9 });
    } else if (k === 'F1') e.preventDefault();
    e.stopPropagation(); // the keys of the program (F-keys, Ctrl+letters) must not act on the panels behind the window
  });
  q('.help-close').onclick = () => close();

  const closeModal = openModal(box);
  helpWin = { box, go, focusSearch: () => search.focus() };
  close = () => { helpWin = null; closeModal(); };
  paint();
  search.focus();
}
