'use strict';
// A self-signed certificate for the HTTPS / FTPS tests, made with the openssl of the machine (tests that need it are skipped without openssl).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

let cached;

function makeCert() {
  if (cached !== undefined) return cached;
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmdr-cert-'));
    const key = path.join(dir, 'key.pem');
    const cert = path.join(dir, 'cert.pem');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '2', '-subj', '/CN=localhost'], {
      stdio: 'ignore',
      env: { ...process.env, MSYS_NO_PATHCONV: '1' },
    });
    cached = { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    cached = null;
  }
  return cached;
}

module.exports = { makeCert };
