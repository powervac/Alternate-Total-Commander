'use strict';
// F4 text editor (Shift+F4: new file). Keeps the file's encoding and line endings.
// Uses helpers from app.js (A, P, esc, fmtNum, splitExt, dialog, msg, openModal, modalCount, api, arcModify, arcPrefix, isMac)
// and viewer.js (vDetect, vIsBinary).

const ED_MAX = 8 * 1024 * 1024;
const ED_LH = 17;
const ED_ENCS = [
  ['utf-8', 'UTF-8'],
  ['utf-8-bom', 'UTF-8 with BOM'],
  ['utf-16le', 'UTF-16 LE'],
  ['utf-16be', 'UTF-16 BE'],
  ['windows-1251', 'Windows-1251'],
  ['ibm866', 'CP866 (DOS)'],
  ['windows-1252', 'Latin-1'],
];

const edTables = new Map();
/** char -> byte table of a single-byte encoding */
function edTable(enc) {
  if (edTables.has(enc)) return edTables.get(enc);
  const dec = new TextDecoder(enc);
  const m = new Map();
  for (let b = 0; b < 256; b++) {
    const ch = dec.decode(Uint8Array.of(b));
    if (ch && ch !== '�' && !m.has(ch)) m.set(ch, b);
  }
  edTables.set(enc, m);
  return m;
}

function edDecode(bytes, enc) {
  const name = enc === 'utf-8-bom' ? 'utf-8' : enc;
  let t;
  try { t = new TextDecoder(name).decode(bytes); } catch { t = new TextDecoder('windows-1251').decode(bytes); }
  return t.replace(/\r\n|\r/g, '\n');
}

/** returns { bytes, bad } where bad = characters the encoding cannot represent */
function edEncode(text, enc, eol) {
  const s = eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
  if (enc === 'utf-8' || enc === 'utf-8-bom') {
    const b = new TextEncoder().encode(s);
    if (enc === 'utf-8') return { bytes: b, bad: 0 };
    const out = new Uint8Array(b.length + 3);
    out.set([0xef, 0xbb, 0xbf]);
    out.set(b, 3);
    return { bytes: out, bad: 0 };
  }
  if (enc === 'utf-16le' || enc === 'utf-16be') {
    const le = enc === 'utf-16le';
    const out = new Uint8Array(2 + s.length * 2);
    out[0] = le ? 0xff : 0xfe;
    out[1] = le ? 0xfe : 0xff;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      const p = 2 + i * 2;
      out[p] = le ? c & 255 : c >> 8;
      out[p + 1] = le ? c >> 8 : c & 255;
    }
    return { bytes: out, bad: 0 };
  }
  const map = edTable(enc);
  const out = new Uint8Array(s.length);
  let bad = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 128) out[i] = c;
    else {
      const b = map.get(s[i]);
      if (b === undefined) { out[i] = 63; bad++; } else out[i] = b;
    }
  }
  return { bytes: out, bad };
}

const EDIT_BTNS = [{ label: 'OK', value: 'ok', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }];

/** Shift+F4: ask for a name, create the (empty) file and edit it */
async function newFileEdit() {
  const p = A();
  if (p.arc || p.rem) return msg('Edit new file', 'Creating files inside an archive or on a NAS is not supported. Create it in a local folder.');
  const r = await dialog({ title: 'Edit new file', text: 'File name:', input: 'new.txt', buttons: EDIT_BTNS });
  const name = r.input && r.input.trim();
  if (r.value !== 'ok' || !name) return;
  if (/[\\/:*?"<>|]/.test(name)) return msg('Edit new file', 'The name contains characters that are not allowed.');
  const full = P.join(p.dir, name);
  const st = await api.stat(full);
  if (st.exists && st.isDir) return msg('Edit new file', 'A folder with this name already exists.');
  if (!st.exists) {
    const w = await api.writeFile({ file: full, data: new Uint8Array(0) });
    if (w.error) return msg('Error', w.error);
  }
  await p.load(p.dir, { push: false, focusName: name });
  openEditor();
}

async function openEditor() {
  if (modalCount > 0) return;
  const panel = A();
  const cur = panel.cur();
  if (!cur || cur.up || cur.isDir) return;
  const fname = cur.name;

  // ---- resolve the real file (files inside an archive are edited as a temp copy and written back)
  let file;
  if (panel.rem) {
    if (panel.rem.path === '/') return;
    const t = await api.nasTemp({ id: panel.rem.id, path: remJoin(panel.rem.path, fname) });
    if (t.error) return msg('NAS', t.error);
    file = t.file;
  } else if (panel.arc) {
    const t = await api.zipTemp({ archive: panel.arc.file, inner: panel.arc.inner, name: fname });
    if (t.error) return msg('Error', t.error);
    file = t.file;
  } else file = P.join(panel.dir, fname);

  const r = await api.viewRead({ file, max: ED_MAX + 1 });
  if (r.error) return msg('Error', r.error);
  const askExternal = async (why) => {
    const d = await dialog({
      title: 'Edit',
      text: why,
      buttons: [{ label: 'Open externally', value: 'ext', primary: true }, { label: 'Cancel', value: 'cancel', cancel: true }],
    });
    if (d.value === 'ext') {
      const e = await api.open(file);
      if (e) msg('Error', e);
    }
  };
  if (r.size > ED_MAX) return askExternal(`"${fname}" is larger than ${fmtNum(ED_MAX / 1024 / 1024)} MB (${fmtNum(r.size)} bytes).\nOpen it with the default application instead?`);
  let bytes = r.data;
  if (bytes.length && vIsBinary(bytes)) return askExternal(`"${fname}" looks like a binary file.\nOpen it with the default application instead?`);

  // ---- encoding + line ending detection
  let enc = bytes.length ? vDetect(bytes) : 'utf-8';
  if (enc === 'utf-8' && bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) enc = 'utf-8-bom';
  const raw = edDecode(bytes, enc);
  const rawText = new TextDecoder(enc === 'utf-8-bom' ? 'utf-8' : enc).decode(bytes);
  const crlf = (rawText.match(/\r\n/g) || []).length;
  const lf = (rawText.match(/(^|[^\r])\n/g) || []).length;
  let eol = crlf > lf ? '\r\n' : crlf === 0 && lf === 0 && api.platform === 'win32' ? '\r\n' : '\n';

  // ---- UI
  const box = document.createElement('div');
  box.className = 'viewer editor';
  box.innerHTML =
    '<div class="v-bar"><span class="v-name e-name"></span><span class="v-info e-info"></span><span class="v-sp"></span>' +
    '<label>Encoding <select class="e-enc">' + ED_ENCS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('') + '</select></label>' +
    '<button class="e-save" title="Ctrl+S">Save</button><button class="e-x" title="Esc">Close</button></div>' +
    '<div class="e-main"><pre class="e-gutter"></pre><textarea class="e-ta" spellcheck="false" wrap="off"></textarea></div>' +
    '<div class="v-foot e-foot"><input class="e-find" placeholder="Find (Ctrl+F)" spellcheck="false"><input class="e-repl" placeholder="Replace with" spellcheck="false">' +
    '<button class="e-next" title="F3">Find next</button><button class="e-rep">Replace</button><button class="e-all">Replace all</button>' +
    '<label><input type="checkbox" class="e-case"> Match case</label><span class="v-sp"></span>' +
    '<button class="e-eol" title="Click to switch the line ending"></button><span class="v-pos e-pos"></span></div>';
  const q = (s) => box.querySelector(s);
  const $ta = q('.e-ta'), $gut = q('.e-gutter'), $name = q('.e-name'), $info = q('.e-info');
  const $enc = q('.e-enc'), $find = q('.e-find'), $repl = q('.e-repl'), $case = q('.e-case');
  const $pos = q('.e-pos'), $eol = q('.e-eol');

  let modified = false;
  let origBytes = bytes;
  let gutLines = 0;
  let posRaf = 0;

  $ta.value = raw;
  $enc.value = enc;

  function setTitle() {
    $name.textContent = (modified ? '* ' : '') + fname;
    $info.textContent = panel.arc ? 'in archive ' + P.basename(panel.arc.file) : panel.rem ? 'on NAS ' + panel.rem.name : '';
  }
  function updateGutter() {
    const n = $ta.value.split('\n').length;
    if (n === gutLines) return;
    gutLines = n;
    const a = new Array(n);
    for (let i = 0; i < n; i++) a[i] = i + 1;
    $gut.textContent = a.join('\n');
    $gut.style.minWidth = String(n).length + 3 + 'ch';
  }
  function updatePos() {
    cancelAnimationFrame(posRaf);
    posRaf = requestAnimationFrame(() => {
      const v = $ta.value;
      const p = $ta.selectionStart;
      let line = 1;
      for (let i = v.indexOf('\n'); i >= 0 && i < p; i = v.indexOf('\n', i + 1)) line++;
      const col = p - v.lastIndexOf('\n', p - 1);
      $pos.textContent = `Ln ${fmtNum(line)}, Col ${fmtNum(col)}`;
    });
  }
  function setEol() { $eol.textContent = eol === '\r\n' ? 'CRLF' : 'LF'; }

  function scrollToPos(p) {
    const v = $ta.value;
    let line = 0;
    for (let i = v.indexOf('\n'); i >= 0 && i < p; i = v.indexOf('\n', i + 1)) line++;
    $ta.scrollTop = Math.max(0, line * ED_LH - $ta.clientHeight / 2);
  }

  // ---- find / replace
  function status(t) { $pos.textContent = t; }
  function findNext(dir = 1) {
    const needle = $find.value;
    if (!needle) return false;
    const cs = $case.checked;
    const hay = cs ? $ta.value : $ta.value.toLowerCase();
    const nd = cs ? needle : needle.toLowerCase();
    let i;
    if (dir > 0) {
      i = hay.indexOf(nd, $ta.selectionEnd);
      if (i < 0) i = hay.indexOf(nd, 0);
    } else {
      const from = $ta.selectionStart - 1;
      i = from >= 0 ? hay.lastIndexOf(nd, from) : -1;
      if (i < 0) i = hay.lastIndexOf(nd);
    }
    if (i < 0) { status('Not found: ' + needle); return false; }
    $ta.setSelectionRange(i, i + nd.length);
    scrollToPos(i);
    return true;
  }
  function insertText(t) {
    $ta.focus();
    if (!document.execCommand('insertText', false, t)) {
      const s = $ta.selectionStart;
      $ta.setRangeText(t, s, $ta.selectionEnd, 'end');
      $ta.dispatchEvent(new Event('input'));
    }
  }
  function replaceOne() {
    const needle = $find.value;
    if (!needle) return;
    const sel = $ta.value.slice($ta.selectionStart, $ta.selectionEnd);
    const same = $case.checked ? sel === needle : sel.toLowerCase() === needle.toLowerCase();
    if (same) insertText($repl.value);
    findNext(1);
  }
  function replaceAll() {
    const needle = $find.value;
    if (!needle) return;
    const v = $ta.value;
    const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $case.checked ? 'g' : 'gi');
    let n = 0;
    const out = v.replace(re, () => { n++; return $repl.value; });
    if (!n) return status('Not found: ' + needle);
    $ta.select();
    insertText(out);
    status(`${n} replaced`);
  }

  // ---- save / close
  async function save() {
    let useEnc = $enc.value;
    let { bytes: out, bad } = edEncode($ta.value, useEnc, eol);
    if (bad) {
      const d = await dialog({
        title: 'Save',
        text: `${bad} character(s) cannot be stored in ${ED_ENCS.find(([v]) => v === useEnc)[1]}.\nThey would be replaced by "?".`,
        buttons: [
          { label: 'Save as UTF-8', value: 'utf8', primary: true },
          { label: 'Save with "?"', value: 'q' },
          { label: 'Cancel', value: 'cancel', cancel: true },
        ],
      });
      $ta.focus();
      if (d.value === 'cancel') return false;
      if (d.value === 'utf8') {
        useEnc = 'utf-8';
        $enc.value = useEnc;
        out = edEncode($ta.value, useEnc, eol).bytes;
      }
    }
    const w = await api.writeFile({ file, data: out });
    if (w.error) { await msg('Error', w.error); $ta.focus(); return false; }
    if (panel.rem) {
      const up = await api.nasPut({ id: panel.rem.id, localFile: file, destFolder: panel.rem.path, name: fname });
      if (up.error) { await msg('NAS', up.error); $ta.focus(); return false; }
      await Promise.all(panels.map((p) => p.refresh()));
    } else if (panel.arc) {
      const res = await arcModify('Updating archive', panel.arc.file, { add: [{ abs: file, rel: arcPrefix(panel) + fname }] });
      if (res.errors.length || res.cancelled) return false;
    } else {
      await Promise.all(panels.map((p) => p.refresh()));
    }
    origBytes = out;
    enc = useEnc;
    modified = false;
    setTitle();
    $ta.focus();
    return true;
  }

  async function tryClose() {
    if (modified) {
      const d = await dialog({
        title: 'Edit',
        text: `Save changes to "${fname}"?`,
        buttons: [
          { label: 'Save', value: 'save', primary: true },
          { label: "Don't save", value: 'no' },
          { label: 'Cancel', value: 'cancel', cancel: true },
        ],
      });
      if (d.value === 'cancel') { $ta.focus(); return; }
      if (d.value === 'save' && !(await save())) return;
    }
    box.remove();
    modalCount--;
    panel.focus();
  }

  async function gotoLine() {
    const d = await dialog({ title: 'Go to line', text: 'Line number:', input: '', buttons: EDIT_BTNS });
    $ta.focus();
    const n = parseInt(d.input, 10);
    if (d.value !== 'ok' || !(n > 0)) return;
    const lines = $ta.value.split('\n');
    const line = Math.min(n, lines.length);
    let pos = 0;
    for (let i = 0; i < line - 1; i++) pos += lines[i].length + 1;
    $ta.setSelectionRange(pos, pos);
    scrollToPos(pos);
    updatePos();
  }

  // ---- events
  $ta.addEventListener('input', () => { modified = true; setTitle(); updateGutter(); updatePos(); });
  $ta.addEventListener('scroll', () => { $gut.scrollTop = $ta.scrollTop; });
  for (const ev of ['keyup', 'mouseup', 'focus']) $ta.addEventListener(ev, updatePos);
  $enc.onchange = () => {
    const ne = $enc.value;
    if (!modified && origBytes) {
      // untouched: reinterpret the original bytes with the chosen encoding
      enc = ne;
      $ta.value = edDecode(origBytes, enc);
      gutLines = 0;
      updateGutter();
    } else {
      enc = ne; // edited: only the encoding used when saving changes
      setTitle();
    }
    $ta.focus();
  };
  $eol.onclick = () => { eol = eol === '\r\n' ? '\n' : '\r\n'; modified = true; setEol(); setTitle(); $ta.focus(); };
  q('.e-save').onclick = () => save();
  q('.e-x').onclick = () => tryClose();
  q('.e-next').onclick = () => findNext(1);
  q('.e-rep').onclick = replaceOne;
  q('.e-all').onclick = replaceAll;
  for (const b of box.querySelectorAll('button')) b.onmousedown = (e) => e.preventDefault();

  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    const k = e.key;
    const mod = e.ctrlKey || (isMac && e.metaKey);
    const l = k.length === 1 ? k.toLowerCase() : k;
    if (e.target === $find || e.target === $repl) {
      if (k === 'Enter') { e.preventDefault(); if (e.target === $repl) replaceOne(); else findNext(e.shiftKey ? -1 : 1); return; }
      if (k === 'Escape') { e.preventDefault(); $ta.focus(); return; }
    }
    if (mod && l === 's') { e.preventDefault(); save(); }
    else if (k === 'Escape') { e.preventDefault(); tryClose(); }
    else if (mod && l === 'f') { e.preventDefault(); $find.focus(); $find.select(); }
    else if (mod && l === 'h') { e.preventDefault(); $repl.focus(); $repl.select(); }
    else if (mod && l === 'g') { e.preventDefault(); gotoLine(); }
    else if (k === 'F3') { e.preventDefault(); findNext(e.shiftKey ? -1 : 1); }
    else if (k === 'Tab' && e.target === $ta && !mod) { e.preventDefault(); insertText('\t'); }
  });

  modalCount++;
  document.body.appendChild(box);
  setTitle();
  setEol();
  updateGutter();
  updatePos();
  $ta.focus();
  $ta.setSelectionRange(0, 0);
}
