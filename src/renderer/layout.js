'use strict';
// The layout of the two panels: the border between them can be dragged (the share of the left panel is remembered; a double click makes them
// equal), and "one panel" shows the active panel over the whole width (made for thumbnails). The hidden panel keeps its folder: it is still
// the target of F5 / F6, and Tab shows it. Quick view needs two panels, so it shows both while it is on.
// Uses helpers from app.js (panels, A, store, qvIdx, $) and toolbar.js (toolbarSync).

const PANEL_MIN_PX = 180;
const onePanelOn = () => store.get('onePanel', false) === true;

/** the share of the left panel, kept so that no panel becomes narrower than PANEL_MIN_PX */
function clampSplit(r, width) {
  const lo = Math.min(0.5, Math.max(0.1, width > 0 ? PANEL_MIN_PX / width : 0.1));
  const v = Number.isFinite(r) ? r : 0.5;
  return Math.min(1 - lo, Math.max(lo, v));
}

function setSplit(r) {
  const v = clampSplit(r, $('#panels').clientWidth);
  panels[0].el.style.flex = `${v} 1 0`;
  panels[1].el.style.flex = `${1 - v} 1 0`;
  return v;
}

function applyLayout() {
  $('#panels').classList.toggle('one', onePanelOn() && qvIdx === null);
  const saved = Number(store.get('split', 0.5));
  setSplit(Number.isFinite(saved) ? saved : 0.5);
  if (typeof toolbarSync === 'function') toolbarSync();
}

function toggleOnePanel() {
  const on = !onePanelOn();
  if (on && qvIdx !== null) qvOff(); // the quick view panel would be the hidden one
  store.set('onePanel', on);
  applyLayout();
  // the list got another width: the file under the cursor stays in sight
  A().scrollToCursor();
}

function buildSplitter() {
  const box = $('#panels');
  const bar = document.createElement('div');
  bar.id = 'splitter';
  box.insertBefore(bar, $('#p1'));
  bar.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); // keep the keyboard focus, do not select text
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('drag');
    let ratio = null;
    const move = (m) => {
      const r = box.getBoundingClientRect();
      ratio = setSplit((m.clientX - r.left) / r.width);
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
      bar.classList.remove('drag');
      if (ratio !== null) store.set('split', Math.round(ratio * 1000) / 1000);
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  });
  bar.addEventListener('dblclick', () => { store.set('split', 0.5); setSplit(0.5); });
  window.addEventListener('resize', () => setSplit(Number(store.get('split', 0.5))));
}

// ------------------------------------------------------------ thumbnail size: the side of the picture box in pixels, one value per panel
const THUMB_MIN = 64;
const THUMB_MAX = 384;
const THUMB_DEFAULT = 112;
const clampThumb = (v) => (Number.isFinite(+v) && +v > 0 ? Math.min(THUMB_MAX, Math.max(THUMB_MIN, Math.round(+v / 8) * 8)) : THUMB_DEFAULT);
/** how big a picture is asked from the system: in steps, so that moving the slider a little does not load everything again */
const thumbRequest = (box, scale) => { const px = box * (scale > 0 ? scale : 1); return px <= 192 ? 192 : px <= 384 ? 384 : 768; };

if (typeof module !== 'undefined' && module.exports) module.exports = { clampSplit, PANEL_MIN_PX, clampThumb, thumbRequest, THUMB_MIN, THUMB_MAX, THUMB_DEFAULT };
