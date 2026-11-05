'use strict';
// Background music player (mini bar above the F-keys). Enter on an audio file starts it, the rest of the folder follows,
// and it keeps playing while you browse. Native formats (mp3, flac, wav, ogg, aac...) play directly; the others (APE, WavPack,
// ALAC, AIFF, WMA, DSD ...) are decoded by the bundled ffmpeg into a lossless FLAC stream.
// Uses helpers from app.js (panels, A, P, esc, splitExt, api, store, vFileUrl/vDur from viewer.js).

const PL_AUDIO = Object.fromEntries('mp3 wav wave flac ogg oga opus m4a aac wma ape wv tta dsf dff aiff aif aifc mka ac3 dts mpc'.split(' ').map((e) => [e, 1]));
/** formats Chromium cannot decode: go to ffmpeg right away */
const PL_FFMPEG = Object.fromEntries('wma ape wv tta dsf dff aiff aif aifc mka ac3 dts mpc'.split(' ').map((e) => [e, 1]));
const isAudioFile = (name) => !!PL_AUDIO[splitExt(name)[1].toLowerCase()];

const PL_ICONS = {
  prev: '<path d="M5 4v12M15 4l-8 6 8 6z"/>',
  next: '<path d="M15 4v12M5 4l8 6-8 6z"/>',
  play: '<path d="M6 4l10 6-10 6z"/>',
  pause: '<path d="M6.5 4v12M13.5 4v12"/>',
  shuffle: '<path d="M2.5 6H6l7 8h4.5M2.5 14H6l2-2.3M11 7.5L13 6h4.5"/><path d="M15.5 3.5L18 6l-2.5 2.5M15.5 11.5L18 14l-2.5 2.5"/>',
  repeat: '<path d="M4 9V8a2 2 0 0 1 2-2h10M13.5 3.5L16 6l-2.5 2.5"/><path d="M16 11v1a2 2 0 0 1-2 2H4M6.5 16.5L4 14l2.5-2.5"/>',
  close: '<path d="M5 5l10 10M15 5L5 15"/>',
};
const plSvg = (n) => `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">${PL_ICONS[n]}</svg>`;

const pl = {
  bar: null,
  el: null,
  loc: null, // where the queue comes from: {kind:'local',dir} | {kind:'rem',id,path} | {kind:'arc',file,inner}
  queue: [], // file names
  i: -1,
  shuffle: false,
  repeat: 'off', // off | all | one
  tc: null, // {prep, offset} while a converted (ffmpeg) stream plays
  spec: null, // ffmpeg input of the current track
  token: 0, // guards against late answers when the track changed
  tags: null,
  dragging: false,
  failed: 0,
};

function plInit() {
  if (pl.bar) return;
  const bar = (pl.bar = document.getElementById('player'));
  pl.el = new Audio();
  pl.el.preload = 'auto';
  pl.el.volume = store.get('plVol', 0.8);
  bar.innerHTML =
    `<button class="pl-prev" title="Previous track (${isMac ? 'Cmd' : 'Ctrl'}+Shift+Left)">${plSvg('prev')}</button>` +
    `<button class="pl-play" title="Play / Pause (${isMac ? 'Option+Space' : 'Ctrl+Space'})"></button>` +
    `<button class="pl-next" title="Next track (${isMac ? 'Cmd' : 'Ctrl'}+Shift+Right)">${plSvg('next')}</button>` +
    '<span class="pl-title"></span><span class="pl-cur">0:00</span>' +
    '<input class="pl-seek" type="range" min="0" max="1000" value="0"><span class="pl-dur">0:00</span>' +
    `<button class="pl-shuf" title="Shuffle">${plSvg('shuffle')}</button><button class="pl-rep" title="Repeat: off">${plSvg('repeat')}</button>` +
    `<input class="pl-vol" type="range" min="0" max="100" value="${Math.round(pl.el.volume * 100)}" title="Volume">` +
    `<button class="pl-x" title="Stop and close the player">${plSvg('close')}</button>`;
  const q = (s) => bar.querySelector(s);
  for (const b of bar.querySelectorAll('button')) b.onmousedown = (e) => e.preventDefault(); // keep the keyboard focus on the panel
  q('.pl-prev').onclick = () => playerStep(-1);
  q('.pl-next').onclick = () => playerStep(1);
  q('.pl-play').onclick = () => playerToggle();
  q('.pl-shuf').onclick = () => { pl.shuffle = !pl.shuffle; plUi(); };
  q('.pl-rep').onclick = () => { pl.repeat = pl.repeat === 'off' ? 'all' : pl.repeat === 'all' ? 'one' : 'off'; plUi(); };
  q('.pl-x').onclick = () => playerStop();
  q('.pl-vol').addEventListener('input', (e) => { pl.el.volume = e.target.value / 100; store.set('plVol', pl.el.volume); });
  const seek = q('.pl-seek');
  seek.addEventListener('input', () => { pl.dragging = true; q('.pl-cur').textContent = vDur((seek.value / 1000) * plDuration()) || '0:00'; });
  seek.addEventListener('change', () => { pl.dragging = false; plSeekTo((seek.value / 1000) * plDuration()); });

  const el = pl.el;
  el.addEventListener('timeupdate', plProgress);
  el.addEventListener('play', plUi);
  el.addEventListener('pause', plUi);
  el.addEventListener('ended', () => playerStep(1, true));
  el.addEventListener('error', () => plError());
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => playerToggle(true));
    ms.setActionHandler('pause', () => playerToggle(false));
    ms.setActionHandler('previoustrack', () => playerStep(-1));
    ms.setActionHandler('nexttrack', () => playerStep(1));
    try { ms.setActionHandler('seekto', (d) => plSeekTo(d.seekTime)); } catch { /* not supported */ }
  }
  plUi();
}

const plDuration = () => (pl.tc ? pl.tc.prep.duration : pl.el.duration) || 0;
const plCurrent = () => (pl.tc ? pl.tc.offset : 0) + (pl.el.currentTime || 0);

function plProgress() {
  if (pl.dragging || !pl.bar) return;
  const d = plDuration();
  const c = plCurrent();
  pl.bar.querySelector('.pl-cur').textContent = vDur(c) || '0:00';
  pl.bar.querySelector('.pl-dur').textContent = d ? vDur(d) : '?';
  pl.bar.querySelector('.pl-seek').value = d ? String(Math.min(1000, Math.round((c / d) * 1000))) : '0';
}

function plTitle() {
  const name = pl.queue[pl.i] || '';
  const t = pl.tags;
  const title = t && t.title ? (t.artist ? `${t.artist} – ${t.title}` : t.title) : name;
  return title + (pl.queue.length > 1 ? `   (${pl.i + 1}/${pl.queue.length})` : '');
}

function plUi() {
  if (!pl.bar) return;
  const on = pl.queue.length > 0;
  pl.bar.classList.toggle('on', on);
  document.body.classList.toggle('player-on', on);
  pl.bar.querySelector('.pl-play').innerHTML = plSvg(pl.el.paused ? 'play' : 'pause');
  pl.bar.querySelector('.pl-title').textContent = plTitle();
  pl.bar.querySelector('.pl-title').title = plTitle();
  pl.bar.querySelector('.pl-shuf').classList.toggle('active', pl.shuffle);
  const rep = pl.bar.querySelector('.pl-rep');
  rep.classList.toggle('active', pl.repeat !== 'off');
  rep.title = 'Repeat: ' + pl.repeat;
  rep.dataset.mode = pl.repeat;
  if ('mediaSession' in navigator && on) {
    const t = pl.tags || {};
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title || pl.queue[pl.i] || '', artist: t.artist || '', album: t.album || '' });
    navigator.mediaSession.playbackState = pl.el.paused ? 'paused' : 'playing';
  }
  if (typeof toolbarSync === 'function') toolbarSync();
}

/** Enter on an audio file: the audio files of this folder become the queue */
function playerStart(panel, item) {
  plInit();
  pl.loc = panel.rem ? { kind: 'rem', id: panel.rem.id, path: panel.rem.path } : panel.arc ? { kind: 'arc', file: panel.arc.file, inner: panel.arc.inner } : { kind: 'local', dir: panel.dir };
  pl.queue = panel.view.filter((x) => !x.isDir && !x.up && isAudioFile(x.name)).map((x) => x.name);
  pl.failed = 0;
  playTrack(Math.max(0, pl.queue.indexOf(item.name)));
}

/** toolbar / menu button: start with the first audio file of the active panel, or toggle pause */
function playerButton() {
  plInit();
  if (pl.queue.length) return playerToggle();
  const p = A();
  const it = (p.cur() && !p.cur().isDir && isAudioFile(p.cur().name) && p.cur()) || p.view.find((x) => !x.isDir && !x.up && isAudioFile(x.name));
  if (!it) return msg('Player', 'There are no audio files in this folder.');
  playerStart(p, it);
}

async function plResolve(name) {
  const l = pl.loc;
  if (l.kind === 'rem') {
    const s = await api.nasStreamUrl({ id: l.id, path: remJoin(l.path, name) });
    return s.error ? { error: s.error } : { url: s.url, spec: { kind: 'url', value: s.url } };
  }
  let path;
  if (l.kind === 'arc') {
    const t = await api.zipTemp({ archive: l.file, inner: l.inner, name });
    if (t.error) return { error: t.error };
    path = t.file;
  } else path = P.join(l.dir, name);
  return { url: vFileUrl(path), spec: { kind: 'file', value: path } };
}

async function playTrack(i) {
  if (i < 0 || i >= pl.queue.length) return;
  const token = ++pl.token;
  pl.i = i;
  pl.tc = null;
  pl.tags = null;
  pl.el.pause();
  plUi();
  const name = pl.queue[i];
  const src = await plResolve(name);
  if (token !== pl.token) return;
  if (src.error) return plSkip(`${name}: ${src.error}`);
  pl.spec = src.spec;
  const ext = splitExt(name)[1].toLowerCase();
  if (PL_FFMPEG[ext] && (await api.mediaFfmpeg())) return plConverted(token, 0);
  pl.el.src = src.url;
  pl.el.play().catch(() => {});
  plTags(token); // tags in the background
}

/** read artist/title from the file (needs ffmpeg; silently skipped without it) */
async function plTags(token) {
  if (!(await api.mediaFfmpeg())) return;
  const prep = await api.mediaPrepare({ ...pl.spec, audioOnly: true });
  if (token !== pl.token || prep.error) return;
  pl.tags = prep.tags;
  plUi();
}

async function plConverted(token, at) {
  const prep = await api.mediaPrepare({ ...pl.spec, audioOnly: true });
  if (token !== pl.token) return;
  if (prep.error) return plSkip(`${pl.queue[pl.i]}: ${prep.error}`);
  pl.tc = { prep, offset: at };
  pl.tags = prep.tags;
  pl.el.src = `${prep.url}?t=${at}`;
  pl.el.play().catch(() => {});
  plUi();
  plProgress();
}

/** the native decoder gave up: try ffmpeg once, else skip the track */
async function plError() {
  const token = pl.token;
  if (!pl.queue.length || !pl.el.src) return;
  if (!pl.tc && (await api.mediaFfmpeg())) return plConverted(token, plCurrent());
  plSkip(`${pl.queue[pl.i]}: cannot be played`);
}

function plSkip(text) {
  pl.failed++;
  pl.bar.querySelector('.pl-title').textContent = text;
  if (pl.failed < pl.queue.length) setTimeout(() => playerStep(1, true), 800);
  else { pl.failed = 0; pl.el.pause(); }
}

function plSeekTo(t) {
  if (!pl.queue.length) return;
  const d = plDuration();
  t = Math.max(0, d ? Math.min(t, Math.max(0, d - 0.5)) : t);
  if (pl.tc) {
    pl.tc.offset = t;
    pl.el.src = `${pl.tc.prep.url}?t=${t}`;
    pl.el.play().catch(() => {});
  } else pl.el.currentTime = t;
}

/** next / previous track (auto = the track ended by itself) */
function playerStep(dir, auto = false) {
  if (!pl.queue.length) return;
  const n = pl.queue.length;
  let i;
  if (auto && pl.repeat === 'one') i = pl.i;
  else if (pl.shuffle && n > 1) {
    do i = Math.floor(Math.random() * n); while (i === pl.i);
  } else {
    i = pl.i + dir;
    if (i >= n || i < 0) {
      if (pl.repeat === 'all' || !auto) i = (i + n) % n;
      else { pl.el.pause(); pl.el.currentTime = 0; plUi(); return; } // end of the queue
    }
  }
  pl.failed = auto ? pl.failed : 0;
  playTrack(i);
}

function playerToggle(force) {
  if (!pl.queue.length) return playerButton();
  const wantPlay = force === undefined ? pl.el.paused : force;
  if (wantPlay) pl.el.play().catch(() => {});
  else pl.el.pause();
}

/** pause (used when the viewer starts its own player) */
function playerPause() {
  if (pl.el && pl.queue.length) pl.el.pause();
}

function playerStop() {
  if (!pl.el) return;
  pl.token++;
  pl.el.pause();
  pl.el.removeAttribute('src');
  pl.el.load();
  pl.queue = [];
  pl.i = -1;
  pl.tc = null;
  pl.tags = null;
  plUi();
}
