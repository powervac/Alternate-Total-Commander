'use strict';
// F3 viewer: text (auto-detected encoding), hex and images, with virtual scrolling for big files.
// Uses helpers from app.js (A, P, esc, fmtNum, splitExt, modalCount, api).

const V_IMG = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', avif: 'image/avif' };
const V_VIDEO = Object.fromEntries('mp4 m4v mov webm mkv ogv avi wmv flv mpg mpeg 3gp ts m2ts'.split(' ').map((e) => [e, 1]));
const V_AUDIO = Object.fromEntries('mp3 wav wave flac ogg oga m4a aac opus wma ape wv tta dsf dff aiff aif aifc mka ac3 dts mpc'.split(' ').map((e) => [e, 1]));
/** documents rendered by our own code (main/docview.js), no Office needed */
const V_DOC = Object.fromEntries('docx docm dotx xlsx xlsm pptx pptm odt ods odp doc rtf'.split(' ').map((e) => [e, 1]));
/** file:// URL of a local path (Windows or POSIX) */
const vFileUrl = (p) => 'file://' + (p.startsWith('/') ? '' : '/') + encodeURI(p.replace(/\\/g, '/')).replace(/#/g, '%23').replace(/\?/g, '%3F');
const vDur = (s) => (isFinite(s) ? `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');
/** never decodable by Chromium: converted right away */
const V_TC_FIRST = Object.fromEntries('avi wmv flv mpg mpeg ts m2ts wma ape wv tta dsf dff aiff aif aifc mka ac3 dts mpc'.split(' ').map((e) => [e, 1]));
const V_MAX = 16 * 1024 * 1024;
const V_MAX_IMG = 64 * 1024 * 1024;
const V_LH = 17;
const V_ENCS = [
  ['auto', 'Auto'],
  ['utf-8', 'UTF-8'],
  ['utf-16le', 'UTF-16 LE'],
  ['utf-16be', 'UTF-16 BE'],
  ['windows-1251', 'Windows-1251'],
  ['ibm866', 'CP866 (DOS)'],
  ['windows-1252', 'Latin-1'],
];

/** pick an encoding for a byte buffer */
function vDetect(b) {
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return 'utf-8';
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) return 'utf-16le';
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) return 'utf-16be';
  const n = Math.min(b.length, 4096) & ~1;
  if (n >= 4) {
    let odd = 0, even = 0;
    for (let i = 0; i < n; i += 2) { if (b[i] === 0) even++; if (b[i + 1] === 0) odd++; }
    const pairs = n / 2;
    if (odd > pairs * 0.3 && even < pairs * 0.05) return 'utf-16le';
    if (even > pairs * 0.3 && odd < pairs * 0.05) return 'utf-16be';
  }
  try {
    const cut = Math.min(b.length, 65536);
    // do not fail on a multibyte char cut at the end of the sample
    new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(0, cut === b.length ? cut : Math.max(0, cut - 3)));
    return 'utf-8';
  } catch {
    return 'windows-1251';
  }
}

function vIsBinary(b) {
  if (vDetect(b).startsWith('utf-16')) return false;
  const n = Math.min(b.length, 8192);
  for (let i = 0; i < n; i++) if (b[i] === 0) return true;
  return false;
}

function vHexLine(b, i) {
  const off = i * 16;
  let hex = '';
  let asc = '';
  for (let j = 0; j < 16; j++) {
    if (off + j < b.length) {
      const v = b[off + j];
      hex += v.toString(16).padStart(2, '0') + ' ';
      asc += v >= 0x20 && v < 0x7f ? esc(String.fromCharCode(v)) : '.';
    } else hex += '   ';
    if (j === 7) hex += ' ';
  }
  return off.toString(16).padStart(8, '0') + '  ' + hex + ' |' + asc + '|';
}

/** panelArg: a panel-like object with the files to show (Find Files gives its results); force: open above a dialog */
function openViewer(panelArg, force) {
  if (modalCount > 0 && !force) return;
  const panel = panelArg && panelArg.view ? panelArg : A();
  const first = panel.cur();
  if (!first || first.up || first.isDir) return;
  if (V_VIDEO[splitExt(first.name)[1].toLowerCase()] || V_AUDIO[splitExt(first.name)[1].toLowerCase()]) playerPause(); // one sound at a time
  const files = panel.view.filter((i) => !i.isDir && !i.up);
  let idx = Math.max(0, files.findIndex((i) => i.name === first.name));

  const box = document.createElement('div');
  box.className = 'viewer';
  box.innerHTML =
    '<div class="v-bar"><span class="v-name"></span><span class="v-info"></span><span class="v-sp"></span>' +
    '<label>Mode <select class="v-mode"></select></label>' +
    '<label>Encoding <select class="v-enc">' + V_ENCS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('') + '</select></label>' +
    '<button class="v-ext" title="Open with the default application (O)">Open externally</button><button class="v-x" title="Close (Esc)">Close</button></div>' +
    '<div class="v-body"></div>' +
    '<div class="v-foot"><input class="v-find" placeholder="Find (F7)" spellcheck="false"><span class="v-hint">Esc close &nbsp; n/p next/prev file &nbsp; Left/Right next/prev picture &nbsp; 1 text &nbsp; 3 hex &nbsp; e encoding &nbsp; F7 find, F3 next &nbsp; z image fit &nbsp; o open externally &nbsp; video: Space play, ←/→ seek, ↑/↓ volume, f fullscreen, t native/ffmpeg player</span><span class="v-sp"></span><span class="v-pos"></span></div>';
  const q = (s) => box.querySelector(s);
  const $name = q('.v-name'), $info = q('.v-info'), $mode = q('.v-mode'), $enc = q('.v-enc');
  const $body = q('.v-body'), $find = q('.v-find'), $pos = q('.v-pos');

  let bytes = null, size = 0, truncated = false, mode = 'text', file = '', lines = null;
  let encUsed = 'utf-8';
  let vv = null; // virtual list state
  let blobUrl = null;
  let loadToken = 0;
  let lastFind = '';
  let mediaSrc = '';
  let mediaRemPath = ''; // remote path while streaming from the NAS (for "open externally")
  let CW = 7.8;

  const ext = () => splitExt(files[idx].name)[1].toLowerCase();

  // ---------------------------------------------------------------- virtual list
  function renderWin() {
    if (!vv) return;
    const firstLine = Math.max(0, Math.floor($body.scrollTop / V_LH));
    const n = Math.ceil($body.clientHeight / V_LH) + 2;
    const last = Math.min(vv.count, firstLine + n);
    let h = '';
    for (let i = firstLine; i < last; i++) h += `<div class="v-line${i === vv.hl ? ' hit' : ''}">${vv.html(i) || '&nbsp;'}</div>`;
    vv.win.style.top = firstLine * V_LH + 'px';
    vv.win.innerHTML = h;
    updatePos();
  }

  function updatePos() {
    if (!vv) { $pos.textContent = ''; return; }
    const top = Math.floor($body.scrollTop / V_LH);
    const total = vv.count * V_LH;
    const pct = total ? Math.min(100, Math.round((($body.scrollTop + $body.clientHeight) / total) * 100)) : 100;
    $pos.textContent = mode === 'hex' ? `offset ${(top * 16).toString(16).padStart(8, '0')}   ${pct} %` : `line ${fmtNum(top + 1)} / ${fmtNum(vv.count)}   ${pct} %`;
  }

  function mount(count, html, maxChars) {
    $body.className = 'v-body';
    $body.innerHTML = '<div class="v-spacer"><div class="v-win"></div></div>';
    const spacer = $body.firstChild;
    spacer.style.height = count * V_LH + 'px';
    spacer.style.width = Math.ceil(maxChars * CW + 24) + 'px';
    vv = { count, html, win: spacer.firstChild, hl: -1 };
    $body.scrollTop = 0;
    $body.scrollLeft = 0;
    renderWin();
  }

  $body.addEventListener('scroll', renderWin);

  // ---------------------------------------------------------------- modes
  function showText(keepScroll) {
    const top = keepScroll ? $body.scrollTop : 0;
    let enc = $enc.value;
    if (enc === 'auto') enc = vDetect(bytes);
    encUsed = enc;
    let text;
    try {
      text = new TextDecoder(enc).decode(bytes);
    } catch {
      text = new TextDecoder('windows-1251').decode(bytes);
    }
    lines = text.split(/\r\n|\r|\n/);
    let maxLen = 1;
    for (const l of lines) if (l.length > maxLen) maxLen = l.length;
    mount(lines.length, (i) => esc(lines[i]), Math.min(maxLen, 4000));
    if (keepScroll) { $body.scrollTop = top; renderWin(); }
    setInfo();
  }

  function showHex() {
    lines = null;
    mount(Math.ceil(bytes.length / 16), (i) => vHexLine(bytes, i), 80);
    setInfo();
  }

  function showImage() {
    vv = null;
    $pos.textContent = '';
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(new Blob([bytes], { type: V_IMG[ext()] || 'application/octet-stream' }));
    $body.className = 'v-body img';
    $body.innerHTML = '<img class="fit">';
    const img = $body.firstChild;
    img.onload = () => { $pos.textContent = `${img.naturalWidth} x ${img.naturalHeight}`; };
    img.onerror = () => { $body.className = 'v-body msg'; $body.textContent = 'Cannot display this image.'; };
    img.onclick = () => img.classList.toggle('fit');
    img.src = blobUrl;
    setInfo();
  }

  /** Office documents: converted to HTML in the main process and shown right here */
  async function showDoc() {
    vv = null;
    $pos.textContent = '';
    const tok = loadToken;
    $body.className = 'v-body msg';
    $body.textContent = 'Rendering...';
    const r = await api.docRender({ file, ext: ext() });
    if (tok !== loadToken || mode !== 'doc') return;
    if (r.error) { $body.className = 'v-body msg'; $body.textContent = r.error + '\nPress O to open it with the default application.'; return; }
    $body.className = 'v-body doc';
    $body.innerHTML = r.html;
    $body.scrollTop = 0;
    setInfo();
  }

  /** PDF: Chromium's built-in PDF viewer in an iframe fed with a blob: URL */
  function showPdf() {
    vv = null;
    $pos.textContent = '';
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    $body.className = 'v-body pdf';
    $body.innerHTML = '<iframe class="v-pdf" title="PDF"></iframe>';
    $body.firstChild.src = blobUrl;
    setInfo();
  }

  /**
   * Video / audio has two engines:
   *  - native: a <video>/<audio> element (local files straight from disk, NAS files through the local proxy);
   *  - converted: ffmpeg re-encodes what Chromium cannot decode (HEVC, AVI, AC3 sound ...) into a fragmented MP4 stream.
   *    A converted stream has no known length, so seeking restarts it at an offset and the controls are our own.
   * The converter is used automatically when the native player fails; the key T switches by hand.
   */
  let tcTried = false; // the converter was already started for this file (prevents loops)
  let tc = null; // { prep, offset, dragging } while the converted player is shown
  let mediaSpec = null; // { kind: 'file' | 'url', value } - the input for ffmpeg

  function stopMedia() {
    const old = $body.querySelector('video,audio');
    if (old) {
      old.onerror = old.onloadedmetadata = old.onplaying = old.ontimeupdate = old.onplay = old.onpause = old.onended = null; // a detached element must not act any more
      old.pause();
      old.removeAttribute('src');
      old.load();
    }
  }

  function mediaFailed(text) {
    stopMedia();
    tc = null;
    $body.className = 'v-body msg';
    $body.textContent = `${text}\nPress O to open it in your default player.`;
    $pos.textContent = '';
  }

  /** native engine */
  function showMedia(startAt = 0) {
    stopMedia(); // silence the previous player (it may still send events)
    vv = null;
    tc = null;
    $pos.textContent = '';
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    const audio = !!V_AUDIO[ext()];
    $body.className = 'v-body media';
    $body.innerHTML = audio ? '<div class="v-audio"><div class="v-audio-title"></div><audio controls autoplay></audio></div>' : '<video controls autoplay></video>';
    const el = $body.querySelector('video,audio');
    if (audio) $body.querySelector('.v-audio-title').textContent = files[idx].name;
    el.onloadedmetadata = () => {
      // a video track that cannot be decoded (e.g. HEVC) leaves a black picture without an error
      if (!audio && el.videoWidth === 0 && !tcTried) return startConverted(el.currentTime);
      $pos.textContent = (el.videoWidth ? `${el.videoWidth} x ${el.videoHeight}   ` : '') + vDur(el.duration);
      if (startAt) el.currentTime = startAt;
    };
    el.onplaying = () => {
      // picture but no sound although the file has an audio track (AC3/DTS ...): convert
      if (tcTried || el.dataset.checked) return;
      el.dataset.checked = '1';
      setTimeout(() => {
        if (mode === 'media' && !tc && el.isConnected && !el.paused && !el.muted && el.currentTime > 1 && el.webkitAudioDecodedByteCount === 0) startConverted(el.currentTime, true);
      }, 3000);
    };
    el.onerror = () => {
      if (!tcTried) return startConverted(el.currentTime || startAt);
      const code = el.error && el.error.code;
      mediaFailed(code === 4
        ? `This ${audio ? 'audio' : 'video'} format or codec is not supported.`
        : `Cannot play this file${el.error && el.error.message ? ' (' + el.error.message + ')' : ''}.`);
    };
    el.src = mediaSrc;
    setInfo();
  }

  /** ask main to probe the file and, if all is well, switch to the converted player */
  async function startConverted(at = 0, needAudio = false, force = false) {
    if (tcTried && !force) return;
    tcTried = true;
    const token = loadToken;
    $pos.textContent = 'Converting with ffmpeg...';
    const prep = await api.mediaPrepare({ ...mediaSpec, audioOnly: !!V_AUDIO[ext()] });
    if (token !== loadToken) return;
    if (prep.error) return mediaFailed(`Cannot play this file here: ${prep.error}`);
    if (needAudio && !prep.hasAudio) { $pos.textContent = ''; return; } // really a silent video: keep the native player
    showConverted(prep, at);
  }

  /** converted engine with its own controls */
  function showConverted(prep, at) {
    stopMedia();
    vv = null;
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    const tag = prep.hasVideo ? 'video' : 'audio';
    $body.className = 'v-body media';
    $body.innerHTML =
      `<div class="v-tc${prep.hasVideo ? '' : ' aonly'}">${prep.hasVideo ? '' : '<div class="v-audio-title"></div>'}<${tag} autoplay></${tag}>` +
      '<div class="v-ctl"><button class="c-play" title="Space"></button><span class="c-time"></span>' +
      `<input type="range" class="c-seek" min="0" max="${Math.max(1, Math.floor(prep.duration * 10))}" value="0" ${prep.duration ? '' : 'disabled'}>` +
      '<button class="c-mute" title="M">♪</button><input type="range" class="c-vol" min="0" max="100" value="100"><button class="c-fs" title="F">⛶</button><span class="c-badge">converted by ffmpeg</span></div></div>';
    if (!prep.hasVideo) $body.querySelector('.v-audio-title').textContent = files[idx].name;
    const el = $body.querySelector(tag);
    const $play = $body.querySelector('.c-play'), $time = $body.querySelector('.c-time'), $seek = $body.querySelector('.c-seek');
    tc = { prep, offset: 0, dragging: false };

    const cur = () => tc.offset + (el.currentTime || 0);
    const label = (t) => `${vDur(t) || '0:00'} / ${prep.duration ? vDur(prep.duration) : '?'}`;
    const refresh = () => {
      if (!tc) return;
      if (!tc.dragging) $seek.value = String(Math.floor(cur() * 10));
      $time.textContent = label(tc.dragging ? $seek.value / 10 : cur());
      $play.textContent = el.paused ? '▶' : '❚❚';
    };
    el._playAt = (t) => {
      tc.offset = Math.max(0, prep.duration ? Math.min(t, Math.max(0, prep.duration - 1)) : t);
      el.src = `${prep.url}?t=${tc.offset}`;
      el.play().catch(() => {});
    };
    el._cur = cur;
    el.ontimeupdate = refresh;
    el.onplay = refresh;
    el.onpause = refresh;
    el.onended = refresh;
    el.onerror = () => mediaFailed('The converter could not play this file.');
    $seek.addEventListener('input', () => { tc.dragging = true; $time.textContent = label($seek.value / 10); });
    $seek.addEventListener('change', () => { tc.dragging = false; el._playAt($seek.value / 10); });
    $play.onclick = () => (el.paused ? el.play() : el.pause());
    $body.querySelector('.c-mute').onclick = () => { el.muted = !el.muted; };
    $body.querySelector('.c-vol').addEventListener('input', (e) => { el.volume = e.target.value / 100; });
    $body.querySelector('.c-fs').onclick = () => toggleFullscreen();
    el._playAt(at || 0);
    refresh();
    $pos.textContent = (prep.width ? `${prep.width} x ${prep.height}   ` : '') + (prep.duration ? vDur(prep.duration) : '');
    setInfo();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) return document.exitFullscreen();
    const t = tc ? $body.querySelector('.v-tc') : $body.querySelector('video');
    if (t) t.requestFullscreen();
  }

  /** keys of the player: handled here so they win over scrolling */
  function mediaKey(e, k, lower) {
    if (mode !== 'media') return false;
    const el = $body.querySelector('video,audio');
    if (lower === 't') {
      // switch the engine by hand (useful for "no sound" files the checks did not catch)
      const at = el ? (tc ? el._cur() : el.currentTime) : 0;
      if (tc) { tcTried = true; showMedia(at); } else startConverted(at, false, true);
      return true;
    }
    if (!el) return false;
    const step = e.shiftKey ? 30 : 5;
    if (k === ' ') { el.paused ? el.play() : el.pause(); }
    else if (k === 'ArrowRight' || k === 'ArrowLeft') {
      const d = k === 'ArrowRight' ? step : -step;
      if (tc) el._playAt(Math.max(0, el._cur() + d));
      else el.currentTime = Math.max(0, Math.min(el.duration || 1e9, el.currentTime + d));
    }
    else if (k === 'ArrowUp') el.volume = Math.min(1, el.volume + 0.1);
    else if (k === 'ArrowDown') el.volume = Math.max(0, el.volume - 0.1);
    else if (lower === 'm') el.muted = !el.muted;
    else if (lower === 'f') toggleFullscreen();
    else return false;
    return true;
  }

  function setMode(m) {
    mode = m;
    $mode.value = m;
    $enc.disabled = m !== 'text';
    if (m === 'media') return showMedia();
    if (!bytes) return;
    if (m === 'text') showText(false);
    else if (m === 'hex') showHex();
    else if (m === 'pdf') showPdf();
    else if (m === 'doc') showDoc();
    else showImage();
  }

  function setInfo() {
    const f = files[idx];
    $name.textContent = f.name + `   (${idx + 1}/${files.length})`;
    let s = `${fmtNum(size)} bytes`;
    if (truncated) s += `, showing first ${fmtNum(bytes.length)}`;
    if (mode === 'text') s += ` - ${encUsed}`;
    if (mode === 'media' && tc) s += ' - converted by ffmpeg';
    $info.textContent = s;
  }

  function message(text) {
    vv = null;
    bytes = null;
    $body.className = 'v-body msg';
    $body.textContent = text;
    $pos.textContent = '';
  }

  /** video / audio: no full read; find the playable source and hand it to the player */
  async function loadMedia(token, f) {
    mediaRemPath = '';
    file = '';
    if (panel.rem) {
      mediaRemPath = remJoin(panel.rem.path, f.name);
      const s = await api.nasStreamUrl({ id: panel.rem.id, path: mediaRemPath });
      if (token !== loadToken) return;
      if (s.error) return message(s.error);
      mediaSrc = s.url;
      mediaSpec = { kind: 'url', value: s.url };
      size = f.size;
    } else {
      let path;
      if (panel.list && f.arc) {
        const t = await api.zipTemp({ archive: f.arc.file, inner: f.arc.inner, name: f.entry });
        if (token !== loadToken) return;
        if (t.error) return message(t.error);
        path = t.file;
      } else if (panel.arc) {
        const t = await api.zipTemp({ archive: panel.arc.file, inner: panel.arc.inner, name: f.name });
        if (token !== loadToken) return;
        if (t.error) return message(t.error);
        path = t.file;
      } else path = P.join(panel.dir, f.name);
      const r = await api.viewRead({ file: path, max: 0 });
      if (token !== loadToken) return;
      if (r.error) return message(r.error);
      file = path;
      mediaSrc = vFileUrl(path);
      mediaSpec = { kind: 'file', value: path };
      size = r.size;
    }
    bytes = new Uint8Array(0);
    truncated = false;
    $mode.innerHTML = `<option value="media">${V_AUDIO[ext()] ? 'Audio' : 'Video'}</option>`;
    // containers/codecs Chromium never plays go straight to the converter (when ffmpeg is there)
    if (V_TC_FIRST[ext()] && (await api.mediaFfmpeg())) {
      if (token !== loadToken) return;
      mode = 'media';
      $mode.value = 'media';
      $enc.disabled = true;
      await startConverted(0, false, true);
    } else setMode('media');
  }

  async function loadFile() {
    const token = ++loadToken;
    const f = files[idx];
    $name.textContent = f.name + `   (${idx + 1}/${files.length})`;
    $info.textContent = 'loading...';
    stopMedia();
    tc = null;
    tcTried = false;
    mediaSpec = null;
    if (V_VIDEO[ext()] || V_AUDIO[ext()]) return loadMedia(token, f);
    let path;
    if (panel.list && f.arc) {
      const t = await api.zipTemp({ archive: f.arc.file, inner: f.arc.inner, name: f.entry });
      if (token !== loadToken) return;
      if (t.error) return message(t.error);
      path = t.file;
    } else if (panel.rem) {
      const t = await api.nasTemp({ id: panel.rem.id, path: remJoin(panel.rem.path, f.name) });
      if (token !== loadToken) return;
      if (t.error) return message(t.error);
      path = t.file;
    } else if (panel.arc) {
      const t = await api.zipTemp({ archive: panel.arc.file, inner: panel.arc.inner, name: f.name });
      if (token !== loadToken) return;
      if (t.error) return message(t.error);
      path = t.file;
    } else path = P.join(panel.dir, f.name);
    file = path;
    const isImg = !!V_IMG[ext()];
    const isDoc = !!V_DOC[ext()];
    const r0 = await api.viewRead({ file: path, max: 8 });
    // a PDF is recognised by its extension or by the %PDF- signature
    const isPdf = ext() === 'pdf' || (!r0.error && r0.data && r0.data.length >= 5 && String.fromCharCode(...r0.data.subarray(0, 5)) === '%PDF-');
    const r = await api.viewRead({ file: path, max: isImg || isPdf ? V_MAX_IMG : V_MAX });
    if (token !== loadToken) return;
    if (r.error) return message(r.error);
    bytes = r.data;
    size = r.size;
    truncated = r.size > bytes.length;
    const opts = isImg ? [['image', 'Image'], ['text', 'Text'], ['hex', 'Hex']]
      : isPdf ? [['pdf', 'PDF'], ['text', 'Text'], ['hex', 'Hex']]
      : isDoc ? [['doc', 'Document'], ['hex', 'Hex']]
      : [['text', 'Text'], ['hex', 'Hex']];
    $mode.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    if ((isImg || isPdf) && truncated) return message(`This file is too large to display here (over 64 MB).\nPress O to open it with the default application.`);
    setMode(isImg ? 'image' : isPdf ? 'pdf' : isDoc ? 'doc' : vIsBinary(bytes) ? 'hex' : 'text');
  }

  // ---------------------------------------------------------------- find (text mode)
  function doFind(dir) {
    const needle = $find.value;
    if (!needle) return;
    if (mode !== 'text' || !lines) { $pos.textContent = 'Find works in text mode'; return; }
    lastFind = needle;
    const lower = needle.toLowerCase();
    const n = lines.length;
    let start = vv.hl >= 0 ? vv.hl + dir : Math.floor($body.scrollTop / V_LH) + (dir > 0 ? 0 : -1);
    for (let k = 0; k < n; k++) {
      const i = (((start + k * dir) % n) + n) % n;
      if (lines[i].toLowerCase().includes(lower)) {
        vv.hl = i;
        $body.scrollTop = Math.max(0, (i - 3) * V_LH);
        renderWin();
        return;
      }
    }
    $pos.textContent = 'Not found: ' + needle;
  }

  // ---------------------------------------------------------------- keys
  function close() {
    document.removeEventListener('keydown', onKey, true);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    stopMedia();
    box.remove();
    modalCount--;
    // leave the cursor on the last viewed file
    const i = panel.view.findIndex((x) => x.name === files[idx].name);
    if (i >= 0) panel.setCursor(i);
    panel.focus();
  }

  /** the next (d = 1) or previous (d = -1) picture of the folder: other files are skipped; Shift+arrows still scroll a big picture */
  function stepImage(d) {
    for (let j = idx + d; j >= 0 && j < files.length; j += d) {
      if (V_IMG[splitExt(files[j].name)[1].toLowerCase()]) { idx = j; loadFile(); return; }
    }
  }

  function onKey(e) {
    e.stopPropagation();
    const k = e.key;
    if (e.target === $find) {
      if (k === 'Enter') { e.preventDefault(); doFind(e.shiftKey ? -1 : 1); }
      else if (k === 'Escape') { e.preventDefault(); $find.blur(); }
      return;
    }
    if (e.target instanceof HTMLSelectElement && k !== 'Escape') return; // let an open select use the keyboard
    const page = Math.max(V_LH, $body.clientHeight - V_LH * 2);
    const lower = k.length === 1 || /^Key[A-Z]$/.test(e.code || '') ? keyLetter(e) : k;
    e.preventDefault();
    if (k !== 'Escape' && lower !== 'q' && mediaKey(e, k, lower)) return;
    if (k === 'Escape' || lower === 'q') close();
    else if (k === 'ArrowDown') $body.scrollTop += V_LH;
    else if (k === 'ArrowUp') $body.scrollTop -= V_LH;
    else if (k === 'PageDown' || k === ' ') $body.scrollTop += page;
    else if (k === 'PageUp' || k === 'Backspace') $body.scrollTop -= page;
    else if (k === 'Home') { $body.scrollTop = 0; $body.scrollLeft = 0; }
    else if (k === 'End') $body.scrollTop = $body.scrollHeight;
    else if ((k === 'ArrowRight' || k === 'ArrowLeft') && mode === 'image' && !e.shiftKey) stepImage(k === 'ArrowRight' ? 1 : -1); // left / right: the next / previous picture of the folder
    else if (k === 'ArrowRight') $body.scrollLeft += 60;
    else if (k === 'ArrowLeft') $body.scrollLeft -= 60;
    else if (lower === 'n') { if (idx < files.length - 1) { idx++; loadFile(); } }
    else if (lower === 'p') { if (idx > 0) { idx--; loadFile(); } }
    else if (k === '1' && bytes) setMode('text');
    else if (k === '3' && bytes) setMode('hex');
    else if (lower === 'e' && bytes && mode === 'text') {
      const i = V_ENCS.findIndex(([v]) => v === $enc.value);
      $enc.value = V_ENCS[(i + 1) % V_ENCS.length][0];
      showText(true);
    } else if (lower === 'o') { openExternal(); }
    else if (lower === 'z') { const img = $body.querySelector('img'); if (img) img.classList.toggle('fit'); }
    else if (k === 'F7' || k === '/') { $find.focus(); $find.select(); }
    else if (k === 'F3') { if (e.shiftKey) doFind(-1); else if ($find.value) doFind(1); else { $find.focus(); } }
  }

  /** hand the (temp) file over to the system's default application */
  async function openExternal() {
    if (!file && mediaRemPath && panel.rem) {
      // streamed from the NAS: download it first, then hand it over
      $pos.textContent = 'Downloading from the NAS...';
      const t = await api.nasTemp({ id: panel.rem.id, path: mediaRemPath });
      if (t.error) { $pos.textContent = t.error; return; }
      file = t.file;
      $pos.textContent = '';
    }
    if (!file) return;
    const err = await api.open(file);
    if (err) { $pos.textContent = 'Cannot open: ' + err; }
  }
  q('.v-ext').onclick = openExternal;
  q('.v-x').onclick = close;

  $mode.onchange = () => { $mode.blur(); setMode($mode.value); };
  $enc.onchange = () => { $enc.blur(); if (bytes && mode === 'text') showText(true); };

  modalCount++;
  document.body.appendChild(box);
  // measure the monospace char width once the overlay is in the DOM
  const probe = document.createElement('span');
  probe.className = 'v-line';
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;padding:0';
  probe.textContent = 'M'.repeat(80);
  $body.appendChild(probe);
  CW = probe.getBoundingClientRect().width / 80 || 7.8;
  probe.remove();
  document.addEventListener('keydown', onKey, true);
  loadFile();
}
