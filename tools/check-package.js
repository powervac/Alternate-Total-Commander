'use strict';
// electron-builder "afterPack" hook: stops the build when the package holds anything but the program.
// It runs for every system, here and on GitHub. (0.1.936: a "files" list with only exclusions made electron-builder pack the whole
// project folder, old builds and private notes included.)
const fs = require('fs');
const path = require('path');

const ALLOWED = new Set(['src', 'node_modules', 'build/icon.png', 'package.json']);
const MAX_MB = 150; // the program with its libraries is about 100 MB before compression

/** [[path inside the archive, size]] of an app.asar */
function asarFiles(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    const json = Buffer.alloc(head.readUInt32LE(12));
    fs.readSync(fd, json, 0, json.length, 16);
    const out = [];
    (function walk(node, prefix) {
      for (const [name, v] of Object.entries(node.files || {})) {
        if (v.files) walk(v, prefix + name + '/');
        else out.push([prefix + name, v.size || 0]);
      }
    })(JSON.parse(json.toString('utf8')), '');
    return out;
  } finally {
    fs.closeSync(fd);
  }
}

/** what is wrong with a list of packed files: [] when it is only the program */
function problems(files) {
  const bad = files.map(([p]) => p).filter((p) => !ALLOWED.has(p) && !ALLOWED.has(p.split('/')[0]));
  const mb = files.reduce((n, [, size]) => n + size, 0) / 1e6;
  const out = [];
  if (bad.length) out.push(`${bad.length} file(s) that do not belong to the program, such as: ${bad.slice(0, 8).join(', ')}`);
  if (mb > MAX_MB) out.push(`the package holds ${Math.round(mb)} MB (limit ${MAX_MB} MB)`);
  if (!files.some(([p]) => p === 'src/main/main.js')) out.push('src/main/main.js is missing');
  return out;
}

async function afterPack(context) {
  const resources = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app', 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const files = asarFiles(path.join(resources, 'app.asar'));
  const wrong = problems(files);
  if (wrong.length) throw new Error('The package is wrong, the build is stopped: ' + wrong.join('; '));
  console.log(`  • package checked: ${files.length} files, ${Math.round(files.reduce((n, [, s]) => n + s, 0) / 1e6)} MB, only the program`);
}

exports.default = afterPack;
exports.asarFiles = asarFiles;
exports.problems = problems;

// node tools/check-package.js path/to/app.asar
if (require.main === module) {
  const wrong = problems(asarFiles(process.argv[2]));
  console.log(wrong.length ? wrong.join('\n') : 'the package is fine');
  process.exit(wrong.length ? 1 : 0);
}
