'use strict';
// Loads the plain-script AY engine of src/main/ay (the same way src/main/aymusic-proc.js and the pt2player test do): the files are joined
// and run in one vm context; the names the tests need are handed out through `exports`.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', '..', 'src', 'main', 'ay');

function loadEngine(files, names) {
  const code = files.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n') + `\nthis.exports = { ${names.join(', ')} };`;
  const ctx = { atob, Buffer, console };
  vm.runInNewContext(code, ctx, { filename: files.join('+') });
  return ctx.exports;
}

module.exports = { loadEngine };
