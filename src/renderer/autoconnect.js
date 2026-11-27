'use strict';
// "Connect when the program starts and keep connected" (a box in the connection windows): the marked servers are connected quietly after
// the start, asked now and then whether they still answer, and connected again when they do not (a sleeping computer, a lost network).
// A refused login is not repeated: a NAS locks the address out after a few wrong ones.
// Uses helpers from nas.js (nasLoad, connType, remoteConnect, liveConns) and app.js (api, store, RECORD_REM).

const AUTO_TICK_MS = 15000;
const AUTO_PING_MS = 60000;
const AUTO_DELAYS = [15000, 30000, 60000, 120000, 300000];

/** how long to wait before try number n (1, 2, ...) */
const autoDelay = (n) => AUTO_DELAYS[Math.min(AUTO_DELAYS.length - 1, Math.max(0, n - 1))];

/** was the login itself refused (then trying again by itself would only get the address locked)? */
function autoIsRefused(error, code, kind) {
  if (kind === 'nas' && [400, 401, 402, 403, 404, 406, 407, 408, 409, 410].includes(code)) return true;
  return /wrong (user|password)|password is (wrong|incorrect)|incorrect password|login failed|authentication|permission denied|2-step|verification code|account (is )?(disabled|expired)|sign in again|no longer valid|host key|530 /i.test(String(error || ''));
}

/** can this record be connected without asking anything? */
function autoCanConnect(rec, kind) {
  if (rec.pw) return true;
  if (kind === 'ssh') return !!rec.keyPath;
  if (kind === 'ftp' || kind === 'webdav') return !rec.user || rec.user === 'anonymous';
  return false;
}

const autoState = new Map(); // id -> { tries, next, busy, stopped, error, pinged }
const autoGet = (id) => { let s = autoState.get(id); if (!s) autoState.set(id, (s = { tries: 0, next: 0, busy: false, stopped: false, error: '', pinged: 0 })); return s; };

/** the user disconnected: leave this one alone until it is connected by hand or the program is started again */
function autoSuspend(id) { const s = autoGet(id); s.stopped = true; s.error = ''; }
/** the user connected it by hand: watch it again */
function autoResume(id) { autoState.delete(id); }
/** a short text for the drive list when a marked server is not connected */
const autoNote = (id) => { const s = autoState.get(id); return s && s.error ? s.error.split('\n')[0].slice(0, 80) : ''; };

async function autoConnectOne(rec, s) {
  const kind = connType(rec);
  if (!autoCanConnect(rec, kind)) { s.stopped = true; s.error = 'the password is not saved'; return; }
  const secret = rec.pw ? (await api.nasCrypt({ text: rec.pw, decrypt: true })).text || '' : '';
  const res = await remoteConnect(kind, rec, secret);
  if (res && !res.error) {
    s.tries = 0;
    s.error = '';
    s.pinged = Date.now();
    liveConns.set(rec.id, { id: rec.id, name: rec.name, type: RECORD_REM[kind], home: kind === 'ssh' || kind === 'ftp' ? res.home || '/' : '/', openAs: rec.openAs, who: res.account || rec.account || rec.user || '' });
    if (res.route && typeof nasRoutes !== 'undefined') nasRoutes.set(rec.id, res.route);
    return;
  }
  s.error = (res && res.error) || 'no answer';
  if (autoIsRefused(s.error, res && res.code, kind)) s.stopped = true;
  else s.next = Date.now() + autoDelay(++s.tries);
}

async function autoTick() {
  const now = Date.now();
  for (const rec of nasLoad().filter((c) => c.auto)) {
    const s = autoGet(rec.id);
    if (s.busy || s.stopped) continue;
    const live = liveConns.get(rec.id);
    if (live && now - s.pinged < AUTO_PING_MS) continue;
    if (!live && now < s.next) continue;
    s.busy = true;
    // one after the other would let one slow server hold up the rest: each goes its own way
    (async () => {
      try {
        if (live) {
          s.pinged = Date.now();
          const r = await api.nasPing({ id: rec.id, path: live.home || '/' });
          if (r && !r.error) return;
          liveConns.delete(rec.id);
        }
        await autoConnectOne(rec, s);
      } catch (e) {
        s.error = e.message;
        s.next = Date.now() + autoDelay(++s.tries);
      } finally {
        s.busy = false;
      }
    })();
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { autoDelay, autoIsRefused, autoCanConnect, AUTO_DELAYS };
else {
  setTimeout(autoTick, 2500); // soon after the start, when the panels are there
  setInterval(autoTick, AUTO_TICK_MS);
}
