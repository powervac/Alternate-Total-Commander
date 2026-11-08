#!/usr/bin/env python3
"""Download and update counter of https://altcom.cc, made from the access log of nginx (no scripts, no cookies on the site).

It runs on the server (root cron, every 10 minutes) and writes ONE json file into the web root. The file has a secret name that is
not linked from anywhere (see PROJECT_NOTES.md), so only the owner knows the address. The json has counts only, no addresses of visitors.

What is counted (days are UTC days):
  downloads      a complete download of an installer from /downloads/ by a browser, curl or wget: the bytes sent for one visitor and one
                 file on one day add up (resumed and ranged requests too) and must reach 85 % of the file. Per visitor, file and day: once.
                 macOS images are for curl with the key only, so a Mac installation by install-mac.sh is one macOS download.
  updates        the same, but asked by the program itself (User-Agent "Commander-updater"): an update that was downloaded completely.
  update_checks  visitors per day whose program asked latest.json (User-Agent "Commander-updater"): about the number of running programs.
  install_script visitors per day that asked install-mac.sh / install-linux.sh (an installation was started).
Bots (by User-Agent), HEAD requests, redirects, errors and the tools of the owner ("node") are not counted.

The history is kept in the state file: days older than three days are not read from the log again, so the numbers survive
a new container (a new log). Only the last days are counted again from the log (the larger number of the log and the state wins).

  stats.py --log <docker json log> --webroot <dir> --out <secret name.json> --state <dir>   (add --dry-run to print only)
  stats.py --selftest
"""
import argparse, hashlib, json, os, re, sys, tempfile
from datetime import datetime, timedelta, timezone

FILES = {
    'Alternate-Total-Commander-Portable.exe': 'windows',
    'Alternate-Total-Commander-Linux.AppImage': 'linux',
    'Alternate-Total-Commander-macOS-AppleSilicon.dmg': 'macos',
    'Alternate-Total-Commander-macOS-Intel.dmg': 'macos',
}
PLATFORMS = ('windows', 'macos', 'linux')
LINE = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) (\d+) "[^"]*" "([^"]*)"')
BOT = re.compile(r'bot\b|bot/|spider|crawl|slurp|facebookexternalhit|preview|monitor|uptime|python-requests|go-http-client|libwww|headless|scanner|^node$|undici', re.I)
UPDATER = re.compile(r'^Commander-updater')
MONTH = {m: i + 1 for i, m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split())}
COMPLETE = 0.85  # share of the file that must have been sent
KEEP_DAYS = 3    # days that are counted again from the log on every run


def log_time(ts):
    """'08/Nov/2026:04:06:10 +0000' -> UTC datetime"""
    m = re.match(r'(\d+)/(\w+)/(\d+):(\d+):(\d+):(\d+) ([+-])(\d\d)(\d\d)', ts)
    if not m:
        return None
    d, mon, y, hh, mm, ss, sg, oh, om = m.groups()
    off = timedelta(hours=int(oh), minutes=int(om)) * (1 if sg == '+' else -1)
    return (datetime(int(y), MONTH[mon], int(d), int(hh), int(mm), int(ss)) - off).replace(tzinfo=timezone.utc)


def empty_day():
    return {'downloads': {'windows': 0, 'macos': 0, 'linux': 0, 'total': 0}, 'updates': 0, 'update_checks': 0, 'install_script': {'mac': 0, 'linux': 0}}


def count_log(lines, sizes, since_day=None):
    """lines: nginx lines of the access log (text). Returns { 'YYYY-MM-DD': day } for the days >= since_day."""
    dl, up, checks, scripts = {}, {}, {}, {}
    salt = os.urandom(8)  # visitors are told apart only inside this run; nothing of it is stored
    for text in lines:
        m = LINE.match(text)
        if not m:
            continue
        ip, ts, method, target, status, nbytes, ua = m.groups()
        if method != 'GET':
            continue
        t = log_time(ts)
        if t is None:
            continue
        day = t.strftime('%Y-%m-%d')
        if since_day and day < since_day:
            continue
        who = hashlib.sha256(salt + ip.encode()).hexdigest()[:16]
        path = target.split('?', 1)[0]
        status = int(status)
        if path == '/latest.json':
            if status == 200 and UPDATER.match(ua):
                checks.setdefault(day, set()).add(who)
        elif path in ('/install-mac.sh', '/install-linux.sh'):
            if status == 200 and not BOT.search(ua):
                scripts.setdefault((day, 'mac' if 'mac' in path else 'linux'), set()).add(who)
        elif path.startswith('/downloads/'):
            name = path[len('/downloads/'):]
            if name in FILES and status in (200, 206) and (UPDATER.match(ua) or not BOT.search(ua)):
                bucket = up if UPDATER.match(ua) else dl
                key = (day, who, name)
                bucket[key] = bucket.get(key, 0) + int(nbytes)
    days = {}
    day_of = lambda d: days.setdefault(d, empty_day())
    for (day, _who, name), total in dl.items():
        if sizes.get(name) and total >= COMPLETE * sizes[name]:
            x = day_of(day)['downloads']
            x[FILES[name]] += 1
            x['total'] += 1
    for (day, _who, name), total in up.items():
        if sizes.get(name) and total >= COMPLETE * sizes[name]:
            day_of(day)['updates'] += 1
    for day, who in checks.items():
        day_of(day)['update_checks'] = len(who)
    for (day, kind), who in scripts.items():
        day_of(day)['install_script'][kind] = len(who)
    return days


def merge_max(a, b):
    """two versions of one day: the larger number of every counter wins"""
    if isinstance(a, dict):
        return {k: merge_max(a.get(k, 0), b.get(k, 0)) for k in set(a) | set(b)}
    return max(a or 0, b or 0)


def totals(days):
    t = {'downloads': {'windows': 0, 'macos': 0, 'linux': 0, 'total': 0}, 'updates': 0, 'update_checks': 0, 'install_script': {'mac': 0, 'linux': 0}}
    for d in days.values():
        for k in t['downloads']:
            t['downloads'][k] += d['downloads'].get(k, 0)
        t['updates'] += d['updates']
        t['update_checks'] += d['update_checks']
        for k in t['install_script']:
            t['install_script'][k] += d['install_script'].get(k, 0)
    return t


def read_docker_log(path, since_day):
    """the nginx lines of a docker json log; lines of days before since_day are skipped without being parsed"""
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            if since_day:
                i = line.rfind('"time":"')
                if i >= 0 and line[i + 8:i + 18] < since_day:
                    continue
            if '"GET ' not in line:
                continue
            try:
                yield json.loads(line)['log'].rstrip('\n')
            except Exception:
                continue


def run(a, now=None):
    now = now or datetime.now(timezone.utc)
    state_file = os.path.join(a.state, 'state.json')
    state = {}
    try:
        state = json.load(open(state_file, encoding='utf-8'))
    except (OSError, ValueError):
        state = {}
    hist = state.get('days') or {}
    cutoff = (now - timedelta(days=KEEP_DAYS)).strftime('%Y-%m-%d')
    since = cutoff if hist else None  # the first run reads the whole log
    sizes = {n: os.path.getsize(os.path.join(a.webroot, 'downloads', n)) for n in FILES if os.path.exists(os.path.join(a.webroot, 'downloads', n))}
    sizes.update({k: v for k, v in (state.get('sizes') or {}).items() if k not in sizes})
    fresh = count_log(read_docker_log(a.log, since), sizes, since)
    days = dict(hist)
    for d, v in fresh.items():
        days[d] = merge_max(days[d], v) if d in days else v
    days = {d: days[d] for d in sorted(days)}
    out = {
        'generated': now.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'since': next(iter(days), None),
        'total': totals(days),
        'days': days,
        'about': 'Counts per UTC day from the web server log, no visitor data. downloads: complete downloads (once per visitor, file and day); '
                 'updates: updates downloaded by the program; update_checks: visitors per day whose program asked for a new version; '
                 'install_script: installations started with install-mac.sh / install-linux.sh. Totals add up the days.',
    }
    if a.dry_run:
        print(json.dumps({'total': out['total'], 'since': out['since'], 'last_days': dict(list(days.items())[-4:])}, indent=1))
        return out
    os.makedirs(a.state, exist_ok=True)
    state_new = {'days': days, 'sizes': sizes}
    for path, data in ((state_file, state_new), (os.path.join(a.webroot, a.out), out)):
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix='.stats-')
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=1, sort_keys=False)
        os.chmod(tmp, 0o600 if path == state_file else 0o644)
        os.replace(tmp, path)
    return out


def selftest():
    sizes = {'Alternate-Total-Commander-Portable.exe': 1000, 'Alternate-Total-Commander-Linux.AppImage': 2000, 'Alternate-Total-Commander-macOS-Intel.dmg': 3000}

    def L(ip, when, req, status, nbytes, ua):
        return f'{ip} - - [{when} +0000] "{req} HTTP/1.1" {status} {nbytes} "-" "{ua}" "-"'
    ch = 'Mozilla/5.0 Chrome/120'
    lines = [
        L('1.1.1.1', '08/Nov/2026:10:00:00', 'GET /downloads/Alternate-Total-Commander-Portable.exe', 200, 1000, ch),          # complete
        L('1.1.1.1', '08/Nov/2026:10:05:00', 'GET /downloads/Alternate-Total-Commander-Portable.exe', 200, 1000, ch),          # same visitor, same day: once
        L('2.2.2.2', '08/Nov/2026:10:00:00', 'GET /downloads/Alternate-Total-Commander-Portable.exe', 200, 400, ch),           # aborted
        L('3.3.3.3', '08/Nov/2026:10:00:00', 'GET /downloads/Alternate-Total-Commander-Portable.exe', 206, 500, ch),           # resumed in two parts
        L('3.3.3.3', '08/Nov/2026:10:01:00', 'GET /downloads/Alternate-Total-Commander-Portable.exe', 206, 500, ch),
        L('4.4.4.4', '08/Nov/2026:10:00:00', 'GET /downloads/Alternate-Total-Commander-Portable.exe', 301, 169, ch),           # redirect
        L('5.5.5.5', '08/Nov/2026:10:00:00', 'GET /downloads/Alternate-Total-Commander-Portable.exe', 200, 1000, 'Googlebot/2.1'),  # bot
        L('6.6.6.6', '08/Nov/2026:10:00:00', 'HEAD /downloads/Alternate-Total-Commander-Portable.exe', 200, 0, ch),             # HEAD
        L('7.7.7.7', '08/Nov/2026:10:00:00', 'GET /downloads/Alternate-Total-Commander-Linux.AppImage', 200, 2000, 'curl/8.1'),  # linux
        L('8.8.8.8', '08/Nov/2026:23:59:59', 'GET /downloads/Alternate-Total-Commander-macOS-Intel.dmg?k=abc', 200, 3000, 'curl/8.7.1'),  # mac
        L('9.9.9.9', '09/Nov/2026:00:00:01', 'GET /downloads/Alternate-Total-Commander-Portable.exe', 200, 1000, 'Commander-updater'),  # an update
        L('9.9.9.9', '09/Nov/2026:00:00:00', 'GET /latest.json?t=1', 200, 700, 'Commander-updater'),
        L('9.9.9.9', '09/Nov/2026:00:10:00', 'GET /latest.json?t=2', 200, 700, 'Commander-updater'),                          # the same visitor: one check
        L('10.0.0.1', '09/Nov/2026:00:00:00', 'GET /latest.json?t=3', 200, 700, 'Commander-updater'),
        L('10.0.0.2', '09/Nov/2026:00:00:00', 'GET /latest.json?t=3', 200, 700, 'node'),                                       # a tool: not counted
        L('11.0.0.1', '09/Nov/2026:01:00:00', 'GET /install-mac.sh', 200, 2221, 'curl/8.7.1'),
        L('11.0.0.2', '09/Nov/2026:01:00:00', 'GET /install-linux.sh', 200, 2030, 'curl/8.7.1'),
        L('11.0.0.2', '09/Nov/2026:01:00:05', 'GET /install-linux.sh', 200, 2030, 'curl/8.7.1'),
        'garbage line',
    ]
    d = count_log(lines, sizes)
    ok = True

    def check(name, got, want):
        nonlocal ok
        if got != want:
            ok = False
            print('FAIL', name, 'got', got, 'want', want)
    check('days', sorted(d), ['2026-11-08', '2026-11-09'])
    a, b = d['2026-11-08'], d['2026-11-09']
    check('win', a['downloads']['windows'], 2)
    check('linux', a['downloads']['linux'], 1)
    check('mac', a['downloads']['macos'], 1)
    check('total', a['downloads']['total'], 4)
    check('updates', b['updates'], 1)
    check('checks', b['update_checks'], 2)
    check('mac script', b['install_script']['mac'], 1)
    check('linux script', b['install_script']['linux'], 1)
    check('no downloads on 9th', b['downloads']['total'], 0)
    check('since', sorted(count_log(lines, sizes, '2026-11-09')), ['2026-11-09'])
    t = totals(d)
    check('totals', (t['downloads']['total'], t['updates'], t['update_checks']), (4, 1, 2))
    check('merge', merge_max({'a': 1, 'b': {'c': 5}}, {'a': 3, 'b': {'c': 2, 'd': 1}}), {'a': 3, 'b': {'c': 5, 'd': 1}})
    print('selftest ok' if ok else 'selftest FAILED')
    return 0 if ok else 1


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--log')
    p.add_argument('--webroot')
    p.add_argument('--out')
    p.add_argument('--state')
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--selftest', action='store_true')
    a = p.parse_args()
    if a.selftest:
        sys.exit(selftest())
    if not (a.log and a.webroot and a.out and a.state):
        p.error('--log, --webroot, --out and --state are required')
    run(a)
