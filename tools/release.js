#!/usr/bin/env node
'use strict';
// One-command release: version bump, commit + push, Windows build (the portable exe), macOS build on GitHub Actions,
// upload to the download site and latest.json (the program offers the update by itself afterwards).
//
//   npm run release -- 0.1.7 "What is new in this version"
//   npm run release -- patch "notes"            (0.1.6 -> 0.1.7)
//   npm run release -- 0.1.7 "notes"            (asks what to build: Windows, macOS or both)
//   npm run release -- 0.1.7 "notes" --no-mac   (Windows only: the Mac files on the site stay as they are; same: --win-only)
//   npm run release -- 0.1.7 "notes" --no-win   (macOS only: the Windows file stays as it is; same: --mac-only; --both = both)
//   npm run release -- 0.1.7 "notes" --dry-run  (show the steps, change nothing)
//   other flags: --no-push (do not commit / push), --no-build (use the files of the last build in dist-release), 
//
// Everything is uploaded to the main site first. The fast mirror (https://nem68.duckdns.org, a small VPS) pulls the files from it by itself (cron every
// 10 minutes); after a release this script starts that pull at once over ssh (a failure there is only a warning) and, with --wait-mirror, waits for it.
// The program and the download page use the mirror when it has the same version, else the main site.
//
// Needs: git with push rights, the GitHub CLI `gh` (signed in), OpenSSH (ssh / scp) and the deploy key of the server.
// Settings (environment variables, defaults in brackets): RELEASE_HOST [oleg@gieldowa.keenetic.link], RELEASE_PORT [2022],
// RELEASE_KEY [H:/boosty/web/.deploy/id_gieldowa], RELEASE_DIR on the server [total-site], RELEASE_URL [https://total.gieldowa.keenetic.link],
// RELEASE_MIRROR_URL [https://nem68.duckdns.org], RELEASE_MIRROR_HOST [oleg@31.3.218.19], RELEASE_MIRROR_PORT [2022], RELEASE_MIRROR_KEY [H:/boosty/web/.deploy/id_nem68].
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
const MIRROR_URL = (process.env.RELEASE_MIRROR_URL || 'https://nem68.duckdns.org').replace(/\/+$/, '');
const MIRROR_HOST = process.env.RELEASE_MIRROR_HOST || 'oleg@31.3.218.19';
const MIRROR_PORT = process.env.RELEASE_MIRROR_PORT || '2022';
// the key of the mirror: the copy in ~/.ssh when there is one (Windows OpenSSH refuses a key file that other users may read), else the deploy folder
const MIRROR_KEY = process.env.RELEASE_MIRROR_KEY || (fs.existsSync(path.join(os.homedir(), '.ssh', 'id_nem68')) ? path.join(os.homedir(), '.ssh', 'id_nem68') : 'H:/boosty/web/.deploy/id_nem68');
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
const ssh = (cmd, o) => run('ssh', ['-i', KEY, '-p', PORT, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', HOST, cmd], { capture: true, ...o });
const scp = (local, remote) => run('scp', ['-i', KEY, '-P', PORT, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', local, `${HOST}:${remote}`]);
const sha256 = (f) => new Promise((res, rej) => { const h = crypto.createHash('sha256'); fs.createReadStream(f).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
const ask = (q) => new Promise((res) => { if (flags.has('--yes')) return res(true); const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q + ' [y/N] ', (a) => { rl.close(); res(/^y/i.test(a)); }); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ------------------------------------------------------------ arguments
  const pkgFile = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
  let version = pos[0];
  const notes = pos[1];
  if (!version || !notes) die('Usage: npm run release -- <version|patch|minor> "release notes" [--win-only | --mac-only | --both] [--no-push] [--no-build] [--no-mirror] [--wait-mirror] [--dry-run]');
  const cur = pkg.version.split('.').map(Number);
  if (version === 'patch') version = [cur[0], cur[1], cur[2] + 1].join('.');
  else if (version === 'minor') version = [cur[0], cur[1] + 1, 0].join('.');
  if (!/^\d+\.\d+\.\d+$/.test(version)) die('The version must look like 0.1.7 (or "patch" / "minor").');
  const nv = version.split('.').map(Number);
  const diff = nv.reduce((r, n, i) => r || n - cur[i], 0);
  if (diff === 0) log(`Version ${version} is already in package.json: no bump.`);
  else if (diff < 0) die(`${version} is not newer than ${pkg.version}.`);
  // what to build: flags, else a question (without a terminal or with --yes: both, like before)
  let withWin = !(flags.has('--no-win') || flags.has('--mac-only'));
  let withMac = !(flags.has('--no-mac') || flags.has('--win-only'));
  const explicit = ['--no-mac', '--no-win', '--win-only', '--mac-only', '--both'].some((f) => flags.has(f));
  if (!explicit && !flags.has('--yes') && process.stdin.isTTY) {
    console.log('\nWhat do you want to build and publish?\n  1) Windows (portable exe)\n  2) macOS (dmg files, built on GitHub)\n  3) Both');
    const a = await new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question('Choose 1, 2 or 3 [1]: ', (x) => { rl.close(); res(x.trim()); }); });
    withWin = a === '' || a === '1' || a === '3';
    withMac = a === '2' || a === '3';
    if (!withWin && !withMac) die('Nothing chosen.');
  }
  const what = withWin && withMac ? 'Windows + macOS' : withWin ? 'Windows only' : 'macOS only';

  // ------------------------------------------------------------ checks
  if (!DRY) {
    if (!fs.existsSync(KEY)) die(`The deploy key was not found: ${KEY} (set RELEASE_KEY).`);
    if (run('gh', ['auth', 'status'], { capture: true, soft: true, always: true }).code !== 0 && withMac) die('The GitHub CLI is not signed in: run `gh auth login`.');
    const t = ssh('echo ok', { always: true, soft: true });
    if (t.out !== 'ok') die('Cannot reach the server over ssh (check RELEASE_HOST / RELEASE_PORT / RELEASE_KEY).');
  }
  log(`Release ${version} (${what})\n  notes: ${notes}\n  server: ${HOST}:${SITE}`);

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
  if (withWin && !flags.has('--no-build')) {
    if (!DRY) fs.rmSync(OUT, { recursive: true, force: true }); // the Mac files are downloaded after this
    log('Building the Windows portable exe ...');
    run('npx', ['electron-builder', '--win', `-c.directories.output=${OUT}`]);
  }
  if (withWin && !DRY && !fs.existsSync(portable)) die(`The Windows files were not found in ${OUT} (expected version ${version}).`);

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
  const files = withWin ? [{ local: portable, name: 'Alternate-Total-Commander-Portable.exe' }] : [];
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
    // latest.json goes last: only now the program starts to offer the new version. It keeps the entry of the platform that was not built,
    // each platform has its own version (a Windows-only release must not make the Mac programs look for an update that does not exist)
    let old = null;
    for (let i = 0; i < 4 && !old; i++) old = await fetch(`${URL_BASE}/latest.json?t=${Date.now()}`).then((r) => r.json()).catch(() => null);
    if (!old) {
      if (!(withWin && withMac)) die('Cannot read the current latest.json from the site, so the entry of the other platform would be lost. The files are uploaded as .part and not published; run again.');
      old = {};
    }
    const lj = { ...old, version, notes };
    delete lj.win; // the installer is not published any more
    if (withWin) lj.winPortable = { url: `${URL_BASE}/downloads/Alternate-Total-Commander-Portable.exe`, urls: [`${MIRROR_URL}/downloads/Alternate-Total-Commander-Portable.exe`, `${URL_BASE}/downloads/Alternate-Total-Commander-Portable.exe`], sha256: info['Alternate-Total-Commander-Portable.exe'].sha, size: info['Alternate-Total-Commander-Portable.exe'].size, version };
    else if (old.winPortable) lj.winPortable = { ...old.winPortable, version: old.winPortable.version || old.version };
    if (lj.winPortable && !lj.winPortable.urls) lj.winPortable.urls = [`${MIRROR_URL}/downloads/Alternate-Total-Commander-Portable.exe`, lj.winPortable.url]; // the entry of an older release gets the mirror too
    lj.mac = { ...(old.mac || {}), version: withMac ? version : (old.mac && old.mac.version) || old.version || version };
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
    for (const n of files.filter((f) => /Portable\.exe$/.test(f.name)).map((f) => f.name)) {
      // GET and stop reading (the server resets a HEAD request from Node's fetch); the size must be the size that was uploaded
      let h = null;
      for (let i = 0; i < 3 && !h; i++) h = await fetch(`${URL_BASE}/downloads/${n}`).catch(() => null);
      if (!h || !h.ok) die(`${n} is not reachable on the site (${h ? 'HTTP ' + h.status : 'no answer'}); the upload itself finished, check the server.`);
      const len = +h.headers.get('content-length');
      if (h.body) await h.body.cancel().catch(() => {});
      if (len && info[n] && len !== info[n].size) die(`${n} on the site has the size ${len}, but ${info[n].size} bytes were uploaded.`);
    }
  }
  // the mirror pulls from the main site (it does that every 10 minutes anyway); started now it is ready a few minutes after the upload
  if (!flags.has('--no-mirror')) {
    if (!fs.existsSync(MIRROR_KEY)) log(`(mirror: the key ${MIRROR_KEY} is not here: the mirror will pull by itself within 10 minutes)`);
    else {
      const m = run('ssh', ['-i', MIRROR_KEY, '-p', MIRROR_PORT, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', MIRROR_HOST, 'nohup ~/total-mirror/pull.sh >/dev/null 2>&1 & echo started'], { capture: true, soft: true, always: false });
      if (!DRY) log(m.out === 'started' ? 'Mirror: the pull has been started (the files arrive in a few minutes).' : 'Mirror: could not be started over ssh; it will pull by itself within 10 minutes.');
    }
    if (flags.has('--wait-mirror') && !DRY) {
      log(`Waiting for the mirror (${MIRROR_URL}) ...`);
      let ok = false;
      for (let i = 0; i < 120 && !ok; i++) {
        await sleep(5000);
        const j = await fetch(`${MIRROR_URL}/latest.json?t=${Date.now()}`).then((r) => r.json()).catch(() => null);
        ok = !!(j && j.version === version);
      }
      log(ok ? 'The mirror has this version.' : 'The mirror does not have this version yet (the programs use the main site until it does).');
    }
  }
  log(`Done: ${version} is on the site. Programs offer the update at their next start (Configuration > Check for Updates...).`);
})().catch((e) => die(e.stack || e.message));
