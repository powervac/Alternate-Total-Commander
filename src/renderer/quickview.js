'use strict';
// Ctrl+Q quick view: the inactive panel shows a preview of the file under the cursor of the active one.
// Uses helpers from app.js (panels, P, esc, fmtNum, fmtDate, splitExt, api, qvIdx) and viewer.js (vDetect, vIsBinary, vHexLine, V_IMG).

const QV_TEXT_MAX = 256 * 1024;
const QV_HEX_MAX = 8 * 1024;
const QV_IMG_MAX = 20 * 1024 * 1024;
const QV_ARC_MAX = 2 * 1024 * 1024;
let qvTimer = 0;
let qvToken = 0;
let qvBlob = null;

function qvToggle() {
  if (qvIdx !== null) return qvOff();
  const src = A();
  const target = panels[1 - src.idx];
  qvIdx = target.idx;
  target.qv = true;
  target.el.classList.add('qv');
  toolbarSync();
  qvUpdate();
}

function qvOff() {
  if (qvIdx === null) return;
  const p = panels[qvIdx];
  qvIdx = null;
  qvToken++;
  clearTimeout(qvTimer);
  if (qvBlob) { URL.revokeObjectURL(qvBlob); qvBlob = null; }
  p.qv = false;
  p.el.classList.remove('qv');
  p.$qv.innerHTML = '';
  toolbarSync();
  p.updateHeader();
  p.updateStatus();
}

function qvSchedule() {
  clearTimeout(qvTimer);
  qvTimer = setTimeout(qvUpdate, 120);
}

async function qvUpdate() {
  if (qvIdx === null) return;
  const dst = panels[qvIdx];
  const src = panels[1 - qvIdx];
  const box = dst.$qv;
  const it = src.cur();
  const token = ++qvToken;
  const setView = (html, status, title) => {
    if (token !== qvToken) return;
    if (qvBlob) { URL.revokeObjectURL(qvBlob); qvBlob = null; }
    box.className = 'qvbox';
    box.innerHTML = html;
    dst.$status.textContent = status || '';
    dst.$path.textContent = title || '';
  };
  const msgView = (text, status, title) => setView(`<div class="qv-msg">${esc(text)}</div>`, status, title);

  if (!it || it.up) return msgView('', '', 'Quick View');
  if (src.rem) return msgView(`${it.name}\n\nOn the NAS${it.isDir ? ' (folder)' : ''}.\n${it.isDir ? '' : 'Press F3 to download and view it.'}`, '', `${src.rem.name}:${src.rem.path}`);
  const full = src.arc ? P.join(src.dir, it.name) : P.join(src.dir, it.name);
  const title = full;

  if (it.isDir) {
    if (src.arc) return msgView(it.name + '\nFolder in archive', '', title);
    const r = await api.list(full);
    if (token !== qvToken) return;
    if (r.error) return msgView(r.error, '', title);
    const dirs = r.items.filter((i) => i.isDir).length;
    const files = r.items.length - dirs;
    const total = r.items.reduce((s, i) => s + (i.isDir ? 0 : i.size), 0);
    return msgView(`${it.name}\n\nFolder\n${fmtNum(files)} file(s), ${fmtNum(dirs)} folder(s)\n${fmtNum(total)} bytes in files\n${fmtDate(it.mtime)}`, `${fmtNum(files)} file(s), ${fmtNum(dirs)} dir(s)`, title);
  }

  const ext = splitExt(it.name)[1].toLowerCase();
  const isImg = !!V_IMG[ext];
  if (V_VIDEO[ext] || V_AUDIO[ext]) return msgView(`${it.name}\n\n${V_AUDIO[ext] ? 'Audio' : 'Video'} file\n${fmtNum(it.size)} bytes\n${fmtDate(it.mtime)}\n\nPress F3 to play it.`, `${fmtNum(it.size)} bytes   ${fmtDate(it.mtime)}`, title);
  if (ext === 'pdf') return msgView(`${it.name}\n\nPDF document\n${fmtNum(it.size)} bytes\n${fmtDate(it.mtime)}\n\nPress F3 to view it.`, `${fmtNum(it.size)} bytes   ${fmtDate(it.mtime)}`, title);
  let path = full;
  if (src.arc) {
    if (it.size > QV_ARC_MAX) return msgView(`${it.name}\n\nToo large to preview from an archive (${fmtNum(it.size)} bytes).\nPress F3 to view it.`, '', title);
    const t = await api.zipTemp({ archive: src.arc.file, inner: src.arc.inner, name: it.name });
    if (token !== qvToken) return;
    if (t.error) return msgView(t.error, '', title);
    path = t.file;
  }
  const r = await api.viewRead({ file: path, max: isImg ? QV_IMG_MAX : QV_TEXT_MAX });
  if (token !== qvToken) return;
  if (r.error) return msgView(r.error, '', title);
  const bytes = r.data;
  const status = `${fmtNum(r.size)} bytes   ${fmtDate(it.mtime)}`;

  if (isImg) {
    if (r.size > bytes.length) return msgView(`${it.name}\n\nImage is too large to preview.`, status, title);
    const url = URL.createObjectURL(new Blob([bytes], { type: V_IMG[ext] }));
    setView('<div class="qv-img"><img></div>', status, title);
    if (token !== qvToken) { URL.revokeObjectURL(url); return; }
    qvBlob = url;
    const img = box.querySelector('img');
    img.onload = () => { if (token === qvToken) dst.$status.textContent = `${img.naturalWidth} x ${img.naturalHeight}   ${status}`; };
    img.onerror = () => { if (token === qvToken) msgView('Cannot display this image.', status, title); };
    img.src = url;
    return;
  }

  if (!bytes.length) return msgView('(empty file)', status, title);

  if (vIsBinary(bytes)) {
    const n = Math.min(bytes.length, QV_HEX_MAX);
    const shown = bytes.subarray(0, n);
    let h = '';
    for (let i = 0; i < Math.ceil(n / 16); i++) h += vHexLine(shown, i) + '\n';
    return setView(`<pre class="qv-text">${h}</pre>${n < r.size ? '<div class="qv-note">... first 8 KB shown</div>' : ''}`, status, title);
  }

  let enc = vDetect(bytes);
  let text;
  try { text = new TextDecoder(enc).decode(bytes); } catch { text = new TextDecoder('windows-1251').decode(bytes); }
  const note = r.size > bytes.length ? `<div class="qv-note">... first ${fmtNum(bytes.length / 1024)} KB shown, press F3 for the whole file</div>` : '';
  setView(`<pre class="qv-text">${esc(text)}</pre>${note}`, `${status}   ${enc}`, title);
}
