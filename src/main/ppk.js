'use strict';
// PuTTY private keys (.ppk, format versions 2 and 3, as WinSCP / PuTTYgen make them) -> a PEM that the SSH library understands.
// The conversion happens in memory when a connection is made; the key file itself is never changed. Encrypted keys need their passphrase
// (version 3 uses Argon2, version 2 SHA-1 + AES-256-CBC). The file's MAC is checked, so a wrong passphrase or a damaged file is reported clearly.
const crypto = require('crypto');

const sha1 = (b) => crypto.createHash('sha1').update(b).digest();
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const sstr = (b) => Buffer.concat([u32(b.length), b]); // SSH "string"

class Reader {
  constructor(b) { this.b = b; this.o = 0; }
  string() { const n = this.b.readUInt32BE(this.o); this.o += 4; const v = this.b.subarray(this.o, this.o + n); this.o += n; return v; }
}
const big = (b) => (b.length ? BigInt('0x' + b.toString('hex')) : 0n);
const stripZeros = (b) => { let i = 0; while (i < b.length - 1 && b[i] === 0) i++; return b.subarray(i); };

// ---- DER helpers (RSAPrivateKey, PKCS#1)
const derLen = (n) => (n < 128 ? Buffer.from([n]) : n < 256 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x82, n >> 8, n & 255]) : Buffer.from([0x83, n >> 16, (n >> 8) & 255, n & 255]));
const derInt = (v) => {
  let h = v.toString(16); if (h.length % 2) h = '0' + h;
  let b = Buffer.from(h, 'hex');
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
  return Buffer.concat([Buffer.from([0x02]), derLen(b.length), b]);
};
const derSeq = (parts) => { const body = Buffer.concat(parts); return Buffer.concat([Buffer.from([0x30]), derLen(body.length), body]); };

function parse(text) {
  const lines = String(text).split(/\r?\n/);
  const first = /^PuTTY-User-Key-File-(\d+): (.+)$/.exec(lines[0] || '');
  if (!first) throw new Error('This is not a PuTTY key file');
  const h = { version: +first[1], algo: first[2].trim() };
  let i = 1;
  while (i < lines.length) {
    const m = /^([A-Za-z0-9-]+): ?(.*)$/.exec(lines[i++]);
    if (!m) continue;
    if (m[1] === 'Public-Lines' || m[1] === 'Private-Lines') { const n = +m[2]; h[m[1]] = Buffer.from(lines.slice(i, i + n).join(''), 'base64'); i += n; }
    else h[m[1]] = m[2].trim();
  }
  if (!h['Public-Lines'] || !h['Private-Lines']) throw new Error('The PuTTY key file is incomplete');
  return h;
}

async function decryptPrivate(h, passphrase) {
  let priv = h['Private-Lines'];
  let macKey = Buffer.alloc(0);
  const enc = h.Encryption || 'none';
  if (enc === 'aes256-cbc') {
    if (!passphrase) { const e = new Error('This key is protected: enter its passphrase.'); e.needPassphrase = true; throw e; }
    let key, iv;
    if (h.version === 2) {
      const p = Buffer.from(passphrase, 'utf8');
      key = Buffer.concat([sha1(Buffer.concat([Buffer.from([0, 0, 0, 0]), p])), sha1(Buffer.concat([Buffer.from([0, 0, 0, 1]), p]))]).subarray(0, 32);
      iv = Buffer.alloc(16);
      macKey = sha1(Buffer.concat([Buffer.from('putty-private-key-file-mac-key'), p]));
    } else {
      const kd = (h['Key-Derivation'] || 'Argon2id').toLowerCase();
      const fn = require('hash-wasm')[kd === 'argon2i' ? 'argon2i' : kd === 'argon2d' ? 'argon2d' : 'argon2id'];
      const out = Buffer.from(await fn({ password: passphrase, salt: Buffer.from(h['Argon2-Salt'], 'hex'), parallelism: +h['Argon2-Parallelism'], iterations: +h['Argon2-Passes'], memorySize: +h['Argon2-Memory'], hashLength: 80, outputType: 'binary' }));
      key = out.subarray(0, 32); iv = out.subarray(32, 48); macKey = out.subarray(48, 80);
    }
    const d = crypto.createDecipheriv('aes-256-cbc', key, iv);
    d.setAutoPadding(false);
    priv = Buffer.concat([d.update(priv), d.final()]);
  } else if (h.version === 2) macKey = sha1(Buffer.from('putty-private-key-file-mac-key'));
  // the MAC covers the algorithm, the encryption name, the comment, the public and the (decrypted) private part
  const data = Buffer.concat([sstr(Buffer.from(h.algo)), sstr(Buffer.from(enc)), sstr(Buffer.from(h.Comment || '', 'utf8')), sstr(h['Public-Lines']), sstr(priv)]);
  const mac = h['Private-MAC'];
  if (mac) {
    const calc = crypto.createHmac(h.version === 2 ? 'sha1' : 'sha256', macKey).update(data).digest('hex');
    if (calc.toLowerCase() !== mac.toLowerCase()) {
      throw new Error(enc === 'aes256-cbc' ? 'Wrong passphrase for this key.' : 'The PuTTY key file is damaged (checksum mismatch).');
    }
  }
  return priv;
}

function rsaPem(pub, priv) {
  const e = big(pub.string()), n = big(pub.string());
  const d = big(priv.string()), p = big(priv.string()), q = big(priv.string()), iqmp = big(priv.string());
  const der = derSeq([derInt(0n), derInt(n), derInt(e), derInt(d), derInt(p), derInt(q), derInt(d % (p - 1n)), derInt(d % (q - 1n)), derInt(iqmp)]);
  return `-----BEGIN RSA PRIVATE KEY-----\n${der.toString('base64').replace(/(.{64})/g, '$1\n')}\n-----END RSA PRIVATE KEY-----\n`;
}

/** an unencrypted OpenSSH-format private key (the SSH library cannot read ed25519 in PKCS#8) */
function opensshEd25519(seed, pubkey, comment) {
  const pubBlob = Buffer.concat([sstr(Buffer.from('ssh-ed25519')), sstr(pubkey)]);
  const check = crypto.randomBytes(4);
  let priv = Buffer.concat([check, check, sstr(Buffer.from('ssh-ed25519')), sstr(pubkey), sstr(Buffer.concat([seed, pubkey])), sstr(Buffer.from(comment || '', 'utf8'))]);
  const pad = (8 - (priv.length % 8)) % 8;
  priv = Buffer.concat([priv, Buffer.from(Array.from({ length: pad }, (_x, i) => i + 1))]);
  const body = Buffer.concat([Buffer.from('openssh-key-v1\0', 'latin1'), sstr(Buffer.from('none')), sstr(Buffer.from('none')), sstr(Buffer.alloc(0)), u32(1), sstr(pubBlob), sstr(priv)]);
  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${body.toString('base64').replace(/(.{70})/g, '$1\n')}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

function ed25519Pem(pub, priv, comment) {
  const pubkey = pub.string();
  const raw = priv.string();
  // the seed is stored as a 32-byte string or as an mpint (big-endian value of the little-endian seed): take the reading whose public key fits
  const stripped = stripZeros(raw);
  const padded = Buffer.concat([Buffer.alloc(Math.max(0, 32 - stripped.length)), stripped]);
  const cands = [raw, padded, Buffer.from(padded).reverse()].filter((c) => c.length === 32);
  for (const seed of cands) {
    try {
      const key = crypto.createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
      const x = Buffer.from(crypto.createPublicKey(key).export({ format: 'jwk' }).x, 'base64url');
      if (x.equals(pubkey)) return opensshEd25519(seed, pubkey, comment);
    } catch { /* next reading */ }
  }
  throw new Error('Cannot read this ed25519 key (the private part does not match the public part).');
}

function ecdsaPem(alg, pub, priv) {
  const crv = { 'ecdsa-sha2-nistp256': 'P-256', 'ecdsa-sha2-nistp384': 'P-384', 'ecdsa-sha2-nistp521': 'P-521' }[alg];
  const size = { 'P-256': 32, 'P-384': 48, 'P-521': 66 }[crv];
  pub.string(); // curve name
  const Q = pub.string();
  const d = stripZeros(priv.string());
  const x = Q.subarray(1, 1 + size), y = Q.subarray(1 + size);
  const dd = Buffer.concat([Buffer.alloc(Math.max(0, size - d.length)), d]);
  const key = crypto.createPrivateKey({ key: { kty: 'EC', crv, x: x.toString('base64url'), y: y.toString('base64url'), d: dd.toString('base64url') }, format: 'jwk' });
  return key.export({ type: 'sec1', format: 'pem' }); // "EC PRIVATE KEY", which the SSH library reads
}

const SUPPORTED = ['ssh-rsa', 'ssh-ed25519', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'];

/** -> { pem, algo, comment }; throws an Error with a readable message (err.needPassphrase when the key is protected) */
async function pemFromPpk(text, passphrase) {
  const h = parse(text);
  if (!SUPPORTED.includes(h.algo)) throw new Error(`The key type ${h.algo} is not supported: export it to OpenSSH format with PuTTYgen.`);
  const privBlob = await decryptPrivate(h, passphrase);
  const pub = new Reader(h['Public-Lines']);
  pub.string(); // algorithm name
  const priv = new Reader(privBlob);
  const pem = h.algo === 'ssh-rsa' ? rsaPem(pub, priv) : h.algo === 'ssh-ed25519' ? ed25519Pem(pub, priv, h.Comment) : ecdsaPem(h.algo, pub, priv);
  return { pem, algo: h.algo, comment: h.Comment || '', version: h.version };
}

const isPpk = (text) => /^PuTTY-User-Key-File-\d+:/.test(String(text));

module.exports = { pemFromPpk, isPpk, parse, SUPPORTED };
