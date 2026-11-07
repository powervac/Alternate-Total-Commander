#!/usr/bin/env python3
"""Feature Requests form of https://altcom.cc : receives the POST of the page (through nginx), keeps every message in a file
and sends it by e-mail to the owner. A message that could not be mailed (the mail server said no, the network was down) stays in the file
and is sent again later: the list of the mailed ones is in sent.txt. Spam protection: a question with a signed one-time answer (captcha),
a hidden field, a minimum time on the page and a limit per IP address."""
import base64, hashlib, hmac, json, os, random, re, secrets, smtplib, ssl, sys, threading, time
from collections import defaultdict, deque
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
try:
    import dkim                       # python3-dkim: signs the mail (DNS: default._domainkey.altcom.cc)
except ImportError:
    dkim = None

TO = 'powervac@gmail.com'
FROM = 'Alternate Commander <feedback@altcom.cc>'
BIND = ('172.18.0.1', 8099)          # the host side of the docker network of nginx
DATA = '/var/lib/altcom-feedback'
MX = 'gmail-smtp-in.l.google.com'
HELO = 'vps16434.awhost.cloud'        # the reverse DNS name (PTR) of the server IP: receivers compare it with the HELO name
DKIM_KEY = os.path.join(DATA, 'dkim.private')
TYPES = {'feature': 'Feature request', 'bug': 'Bug report', 'other': 'Other'}
EMAIL_RE = re.compile(r'^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$')
REQ = os.path.join(DATA, 'requests.jsonl')
SENT = os.path.join(DATA, 'sent.txt')

hits = defaultdict(deque)             # ip -> times of the last submissions
caps = defaultdict(deque)             # ip -> times of the last captcha requests
day = deque()                         # all submissions of the last 24 hours
used = {}                             # captcha tokens that were used -> their expiry
lock = threading.Lock()
SECRET = secrets.token_bytes(32)      # tokens do not survive a restart of the service: the page asks for a new one


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def allowed(ip):
    now = time.time()
    with lock:
        q = hits[ip]
        while q and now - q[0] > 3600:
            q.popleft()
        while day and now - day[0] > 86400:
            day.popleft()
        if len(q) >= 5 or len(day) >= 80:
            return False
        q.append(now)
        day.append(now)
        return True


def cap_allowed(ip):
    now = time.time()
    with lock:
        q = caps[ip]
        while q and now - q[0] > 3600:
            q.popleft()
        if len(q) >= 60:
            return False
        q.append(now)
        return True


# ---------------------------------------------------------------- captcha: a small sum, the answer is inside the signed token (valid 15 minutes, once)
def make_captcha():
    a, b = random.randint(3, 12), random.randint(2, 9)
    op = random.choice(['+', '-', '×'])
    if op == '-' and a < b:
        a, b = b, a
    ans = a + b if op == '+' else a - b if op == '-' else a * b
    payload = '%d:%d:%s' % (ans, int(time.time()) + 900, secrets.token_hex(6))
    sig = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]
    return {'q': 'What is %d %s %d ?' % (a, op, b), 'token': base64.urlsafe_b64encode(payload.encode()).decode() + '.' + sig}


def check_captcha(token, answer):
    try:
        p64, sig = str(token).split('.', 1)
        payload = base64.urlsafe_b64decode(p64.encode()).decode()
        good = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()[:32]
        if not hmac.compare_digest(good, sig):
            return False
        ans, exp, _ = payload.split(':')
        now = time.time()
        with lock:
            for k in [k for k, v in used.items() if v < now]:
                del used[k]
            if int(exp) < now or token in used:
                return False
            used[token] = int(exp)
        return str(answer).strip() == ans
    except Exception:
        return False


# ---------------------------------------------------------------- mail
def send_mail(rec):
    msg = EmailMessage()
    kind = TYPES.get(rec.get('type'), 'Other')
    msg['Subject'] = '[Alternate Commander] %s: %s' % (kind, rec.get('title') or rec.get('message', '')[:60].replace('\n', ' '))
    msg['From'] = FROM
    msg['To'] = TO
    msg['Date'] = formatdate(localtime=True)
    msg['Message-ID'] = make_msgid(domain='altcom.cc')
    if rec.get('email'):
        msg['Reply-To'] = rec['email']
    msg.set_content('Type: %s\nTitle: %s\nFrom: %s <%s>\nTime: %s\nIP: %s\n\n%s\n' % (
        kind, rec.get('title', ''), rec.get('name') or '-', rec.get('email') or 'no e-mail given', rec.get('time'), rec.get('ip'), rec.get('message')))
    try:
        raw = msg.as_bytes()
        if dkim and os.path.exists(DKIM_KEY):
            with open(DKIM_KEY, 'rb') as f:
                raw = dkim.sign(raw, b'default', b'altcom.cc', f.read(), include_headers=[b'from', b'to', b'subject', b'date', b'message-id']) + raw
        else:
            log('mail is NOT signed (no dkim module or key)')
        with smtplib.SMTP(MX, 25, local_hostname=HELO, timeout=40) as s:
            s.starttls(context=ssl.create_default_context())
            s.sendmail('feedback@altcom.cc', [TO], raw)
        log('mail sent:', rec.get('time'), kind)
        return True
    except Exception as e:
        log('mail NOT sent (it stays in requests.jsonl and is tried again):', rec.get('time'), repr(e)[:300])
        return False


def sent_set():
    try:
        return set(open(SENT, encoding='utf-8').read().split())
    except OSError:
        return set()


def deliver(line):
    h = hashlib.sha1(line.encode('utf-8')).hexdigest()[:16]
    with lock:
        if h in sent_set():
            return
    if send_mail(json.loads(line)):
        with lock:
            with open(SENT, 'a', encoding='utf-8') as f:
                f.write(h + '\n')


def retry_loop():
    time.sleep(30)
    while True:
        try:
            with lock:
                done = sent_set()
            if os.path.exists(REQ):
                for line in open(REQ, encoding='utf-8').read().splitlines():
                    if line.strip() and hashlib.sha1(line.encode('utf-8')).hexdigest()[:16] not in done:
                        deliver(line)
                        time.sleep(3)
        except Exception as e:
            log('retry loop:', repr(e))
        time.sleep(900)


class H(BaseHTTPRequestHandler):
    server_version = 'feedback'

    def log_message(self, fmt, *a):
        pass

    def reply(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(b)

    def ip(self):
        return (self.headers.get('X-Real-IP') or self.client_address[0])[:64]

    def do_GET(self):
        if self.path.split('?')[0] != '/api/captcha':
            return self.reply(404, {'error': 'Not found'})
        if not cap_allowed(self.ip()):
            return self.reply(429, {'error': 'Too many requests, please try again later.'})
        self.reply(200, make_captcha())

    def do_POST(self):
        try:
            n = int(self.headers.get('Content-Length') or 0)
            if n <= 0 or n > 32768:
                return self.reply(413, {'error': 'Too much text'})
            d = json.loads(self.rfile.read(n).decode('utf-8'))
            if not isinstance(d, dict):
                raise ValueError('not an object')
        except Exception:
            return self.reply(400, {'error': 'Bad request'})
        ip = self.ip()
        s = lambda k, m: str(d.get(k) or '').strip()[:m]
        rec = {'type': s('type', 12), 'title': s('title', 120), 'message': s('message', 5000), 'email': s('email', 200), 'name': s('name', 80),
               'time': time.strftime('%Y-%m-%d %H:%M:%S UTC', time.gmtime()), 'ip': ip}
        # a robot fills the hidden field or sends the form at once: the answer is "ok", nothing is kept
        if s('website', 200) or (isinstance(d.get('t'), (int, float)) and d['t'] < 2500):
            return self.reply(200, {'ok': True})
        if not check_captcha(s('token', 300), s('captcha', 12)):
            return self.reply(400, {'error': 'The answer to the question is wrong or too old. Please try again.', 'captcha': True})
        if rec['type'] not in TYPES:
            rec['type'] = 'other'
        if len(rec['message']) < 10:
            return self.reply(400, {'error': 'Please describe your idea in a few words (at least 10 characters).', 'captcha': True})
        if rec['email'] and not EMAIL_RE.match(rec['email']):
            return self.reply(400, {'error': 'The e-mail address does not look right (it is optional: leave it empty if you do not want an answer).', 'captcha': True})
        if not allowed(ip):
            return self.reply(429, {'error': 'Too many messages, please try again later.'})
        line = json.dumps(rec, ensure_ascii=False)
        try:
            os.makedirs(DATA, exist_ok=True)
            with lock:
                fd = os.open(REQ, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o600)
                with os.fdopen(fd, 'a', encoding='utf-8') as f:
                    f.write(line + '\n')
        except Exception as e:
            log('cannot store:', repr(e))
            return self.reply(500, {'error': 'The message could not be saved, please try again later.'})
        threading.Thread(target=deliver, args=(line,), daemon=True).start()
        self.reply(200, {'ok': True})


if __name__ == '__main__':
    threading.Thread(target=retry_loop, daemon=True).start()
    ThreadingHTTPServer(BIND, H).serve_forever()
