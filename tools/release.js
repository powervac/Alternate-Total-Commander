#!/usr/bin/env node
'use strict';
// One-command release: version bump, commit + push, Windows build (the portable exe), macOS build on GitHub Actions,
// upload to the download site and latest.json (the program offers the update by itself afterwards).
//
//   npm run release -- 0.1.7 "What is new in this version"
//   npm run release -- patch "notes"            (0.1.6 -> 0.1.7)
//   npm run release -- 0.1.7 "notes" --no-mac   (Windows only: the Mac files on the site stay as they are)
//   npm run release -- 0.1.7 "notes" --dry-run  (show the steps, change nothing)
//   other flags: --no-push (do not commit / push), --no-build (use the files of the last build in dist-release), --yes (no questions)
//
// Needs: git with push rights, the GitHub CLI `gh` (signed in), OpenSSH (ssh / scp) and the deploy key of the server.
// Settings (environment variables, defaults in brackets): RELEASE_HOST [oleg@gieldowa.keenetic.link], RELEASE_PORT [2022],
// RELEASE_KEY [H:/boosty/web/.deploy/id_gieldowa], RELEASE_DIR on the server [total-site], RELEASE_URL [https://total.gieldowa.keenetic.link].
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const HOST = process.env.RELEASE_HOST || 'oleg@gieldowa.keenetic.link';
const PORT = process.env.RELEASE_PORT || '2022';
const KEY = process.env.RELEASE_KEY || 'H:/boosty/web/.deploy/id_gieldowa';
const SITE = process.env.RELEASE_DIR || 'total-site';
const URL_BASE = (process.env.RELEASE_URL || 'https://total.gieldowa.keenetic.link').replace(/\/+$/, '');
const OUT = path.join(ROOT, 'dist-release');
const WIN = process.platform === 'win32';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const pos = args.filter((a) => !a.startsWith('--'));
const DRY = flags.has('--dry-run');
const log = (...a) => console.log('\x1b[36m[release]\x1b[0m', ...a);
const die = (m) => { console.error('\x1b[31m[release] ' + m + '\x1b[0m'); process.exit(1); };

/** run a command; returns { code, out }; with capture the output is returned instead of shown */
function run(cmd, a, opts = {}) {
  const shown = cmd + ' ' + a.map((x) => (/\s/.test(x) ? JSON.stringify(x) : x)).join(' ');
  if (DRY && !opts.always) { log('(dry run) ' + shown); return { code: 0, out: '' }; }
  const r = spawnSync(cmd, a, { cwd: opts.cwd || ROOT, encoding: 'utf8', shell: WIN && (cmd === 'npm' || cmd === 'npx'), stdio: opts.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  if (r.error) die(`${cmd}: ${r.error.message}`);
  if (r.status !== 0 && !opts.soft) die(`Failed: ${shown}${opts.capture ? '\n' + (r.stderr || r.stdout || '') : ''}`);
  return { code: r.status, out: (r.stdout || '').trim() };
}
const ssh = (cmd, o) => run('ssh', ['-i', KEY, '-p', PORT, '-o', 'StrictHostKeyChecking=accept-new', HOST, cmd], { capture: true, ...o });
const scp = (local, remote) => run('scp', ['-i', KEY, '-P', PORT, '-o', 'StrictHostKeyChecking=accept-new', local, `${HOST}:${remote}`]);
const sha256 = (f) => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(f).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
const ask = (q) => new Promise((res) => { if (flags.has('--yes')) return res(true); const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q + ' [y/N] ', (a) => { rl.close(); res(/^y/i.test(a)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ------------------------------------------------------------ arguments
  const pkgFile = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  let version = pos[0];
  const notes = pos[1];
  if (!version || !notes) die('Usage: npm run release -- <version|patch|minor> "release notes" [--no-mac] [--no-push] [--no-build] [--dry-run] [--yes]');
  const cur = pkg.version.split('.').map(Number);
  if (version === 'patch') version = [cur[0], cur[1], cur[2] + 1].join('.');
  else if (version === 'minor') version = [cur[0], cur[1] + 1, 0].join('.');
  if (!/^\d+\.\d+\.\d+$/.test(version)) die('The version must look like 0.1.7 (or "patch" / "minor").');
  const nv = version.split('.').map(Number);
  const diff = nv.reduce((r, n, i) => r || n - cur[i], 0);
  if (diff === 0) log(`Version ${version} is already in package.json: no bump.`);
  else if (diff < 0) die(`${version} is not newer than ${pkg.version}.`);
  const withMac = !flags.has('--no-mac');

  // ------------------------------------------------------------ checks
  if (!DRY) {
    if (!fs.existsSync(KEY)) die(`The deploy key was not found: ${KEY} (set RELEASE_KEY).`);
    if (run('gh', ['auth', 'status'], { capture: true, soft: true, always: true }).code !== 0 && withMac) die('The GitHub CLI is not signed in: run `gh auth login`.');
    const t = ssh('echo ok', { always: true, soft: true });
    if (t.out !== 'ok') die('Cannot reach the server over ssh (check RELEASE_HOST / RELEASE_PORT / RELEASE_KEY).');
  }
  log(`Release ${version}${withMac ? ' (Windows + macOS)' : ' (Windows only)'}\n  notes: ${notes}\n  server: ${HOST}:${SITE}`);
  if (!DRY && !(await ask('Go on?'))) die('Cancelled.');

  // ------------------------------------------------------------ 1. version, commit, push
  let macRun = null;
  if (!flags.has('--no-push')) {
    if (version !== pkg.version) run('npm', ['version', version, '--no-git-tag-version']);
    run('git', ['add', '-A']);
    const dirty = run('git', ['status', '--porcelain'], { capture: true, always: true }).out;
    if (dirty || DRY) run('git', ['commit', '-m', `Version ${version}: ${notes}`.slice(0, 200) + '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>']);
    run('git', ['push']);
  }
  // ------------------------------------------------------------ 2. macOS build on GitHub (in the background)
  if (withMac && !flags.has('--no-build')) {
    const before = Date.now() - 15000;
    run('gh', ['workflow', 'run', 'build-mac.yml']);
    if (!DRY) {
      for (let i = 0; i < 20 && !macRun; i++) {
        await sleep(3000);
        const l = JSON.parse(run('gh', ['run', 'list', '--workflow', 'build-mac.yml', '-L', '3', '--json', 'databaseId,createdAt'], { capture: true }).out || '[]');
        const r = l.find((x) => new Date(x.createdAt).getTime() >= before);
        if (r) macRun = r.databaseId;
      }
      if (!macRun) die('The macOS build did not start on GitHub.');
      log('macOS build started on GitHub: run ' + macRun);
    }
  }
  // ------------------------------------------------------------ 3. Windows build
  const portable = path.join(OUT, `Commander-Portable-${version}.exe`);
  if (!flags.has('--no-build')) {
    if (!DRY) fs.rmSync(OUT, { recursive: true, force: true });
    log('Building the Windows portable exe ...');
    run('npx', ['electron-builder', '--win', `-c.directories.output=${OUT}`]);
  }
  if (!DRY && !fs.existsSync(portable)) die(`The Windows files were not found in ${OUT} (expected version ${version}).`);

  // ------------------------------------------------------------ 4. macOS files
  const dmgs = {};
  if (withMac) {
    const dir = path.join(OUT, 'mac');
    if (!flags.has('--no-build')) {
      log('Waiting for the macOS build ...');
      run('gh', ['run', 'watch', String(macRun), '--exit-status'], { soft: false });
      fs.mkdirSync(dir, { recursive: true });
      run('gh', ['run', 'download', String(macRun), '-D', dir]);
    }
    if (!DRY) {
      const found = [];
      (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.dmg$/.test(e.name)) found.push(p); } })(dir);
      dmgs.arm = found.find((f) => new RegExp(`${version.replace(/\./g, '\\.')}-arm64\\.dmg$`).test(f));
      dmgs.intel = found.find((f) => new RegExp(`${version.replace(/\./g, '\\.')}\\.dmg$`).test(f) && !/arm64/.test(f));
      if (!dmgs.arm || !dmgs.intel) die(`The macOS .dmg files for ${version} were not found in ${dir}.`);
    }
  }

  // ------------------------------------------------------------ 5. upload (as .part first, renamed when everything arrived)
  const files = [{ local: portable, name: 'Alternate-Total-Commander-Portable.exe' }];
  if (withMac) files.push({ local: dmgs.arm, name: 'Alternate-Total-Commander-macOS-AppleSilicon.dmg' }, { local: dmgs.intel, name: 'Alternate-Total-Commander-macOS-Intel.dmg' });
  const info = {};
  for (const f of files) {
    log(`Uploading ${f.name} ...`);
    if (!DRY) { info[f.name] = { sha: await sha256(f.local), size: fs.statSync(f.local).size }; }
    scp(f.local, `${SITE}/downloads/${f.name}.part`);
  }
  if (!DRY) {
    for (const f of files) {
      const r = ssh(`cd ${SITE}/downloads && sha256sum ${f.name}.part | cut -c1-64`).out;
      if (r !== info[f.name].sha) die(`Checksum mismatch on the server for ${f.name}: the upload was damaged. Nothing was published; run again.`);
    }
    const mv = files.map((f) => `mv -f ${f.name}.part ${f.name}`).join(' && ');
    ssh(`cd ${SITE}/downloads && ${mv} && chmod 644 *`);
    // latest.json goes last: only now the program starts to offer the new version
    const lj = {
      version, notes,
      winPortable: { url: `${URL_BASE}/downloads/Alternate-Total-Commander-Portable.exe`, sha256: info['Alternate-Total-Commander-Portable.exe'].sha, size: info['Alternate-Total-Commander-Portable.exe'].size },
    };
    const tmp = path.join(os.tmpdir(), 'commander-latest.json');
    fs.writeFileSync(tmp, JSON.stringify(lj, null, 2) + '\n');
    scp(tmp, `${SITE}/latest.json.part`);
    ssh(`cd ${SITE} && mv -f latest.json.part latest.json`);
    fs.rmSync(tmp, { force: true });
    // check from outside
    // (the router / proxy in front of the server may serve the old file for a few seconds: try again, with a changing address)
    let j = null;
    for (let i = 0; i < 8; i++) {
      j = await fetch(`${URL_BASE}/latest.json?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } }).then((r) => r.json()).catch(() => null);
      if (j && j.version === version) break;
      log('latest.json on the site still shows ' + (j ? j.version : 'nothing') + ', waiting ...');
      await sleep(4000);
    }
    if (!j || j.version !== version) die('latest.json on the site does not show the new version after 30 seconds: check the server (the files are already uploaded).');
    for (const n of ['Alternate-Total-Commander-Portable.exe']) {
      const h = await fetch(`${URL_BASE}/downloads/${n}`, { method: 'HEAD' });
      if (!h.ok) die(`${n} is not reachable on the site (HTTP ${h.status}).`);
    }
  }
  log(`Done: ${version} is on the site. Programs offer the update at their next start (Configuration > Check for Updates...).`);
})().catch((e) => die(e.stack || e.message));
