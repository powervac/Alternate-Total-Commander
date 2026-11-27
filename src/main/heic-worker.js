'use strict';
// Decodes HEIC pictures with libheif (WebAssembly) away from the main process, which must not stand still for the seconds a big photo takes.
const { parentPort } = require('worker_threads');

let lib = null;

async function decode(data) {
  if (!lib) lib = require('libheif-js/wasm-bundle');
  const images = new lib.HeifDecoder().decode(data);
  if (!images || !images.length) throw new Error('This file is not a HEIC picture, or it is damaged.');
  const image = images.find((x) => x.is_primary && x.is_primary()) || images[0];
  try {
    const width = image.get_width();
    const height = image.get_height();
    if (!(width > 0 && height > 0) || width * height > 120e6) throw new Error('The picture is too big or damaged.');
    const shown = await new Promise((resolve, reject) => {
      image.display({ data: new Uint8ClampedArray(width * height * 4), width, height }, (d) => (d ? resolve(d) : reject(new Error('The picture could not be decoded.'))));
    });
    const px = new Uint8Array(shown.data.buffer, shown.data.byteOffset, shown.data.byteLength);
    for (let i = 0; i < px.length; i += 4) { const r = px[i]; px[i] = px[i + 2]; px[i + 2] = r; } // RGBA -> BGRA
    return { width, height, data: px };
  } finally {
    for (const im of images) if (im.free) im.free();
  }
}

// one picture at a time: the memory of two big ones at once would be too much
let chain = Promise.resolve();
parentPort.on('message', ({ id, data }) => {
  chain = chain.then(async () => {
    try {
      const r = await decode(data);
      const out = new Uint8Array(r.data); // a copy of its own, so that it can be moved to the main process
      parentPort.postMessage({ id, width: r.width, height: r.height, data: out }, [out.buffer]);
    } catch (e) {
      parentPort.postMessage({ id, error: (e && e.message) || String(e) });
    }
  });
});
