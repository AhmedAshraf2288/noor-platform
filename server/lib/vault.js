// Field-level encryption at rest: AES-256-GCM, random 96-bit IV per value, authenticated.
// Key: DATA_ENCRYPTION_KEY (64 hex chars) if set, else derived with scrypt from JWT_SECRET.
const crypto = require('crypto');
const config = require('../config');
const PREFIX = 'enc:v1:';
let key;
function getKey() {
  if (key) return key;
  const env = process.env.DATA_ENCRYPTION_KEY || '';
  key = /^[0-9a-fA-F]{64}$/.test(env) ? Buffer.from(env, 'hex') : crypto.scryptSync(config.jwtSecret, 'noor-data-at-rest-v1', 32);
  return key;
}
function seal(plain) {
  if (plain === null || plain === undefined || plain === '') return plain;
  const s = String(plain);
  if (s.startsWith(PREFIX)) return s;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([c.update(s, 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function open(val) {
  if (!val || typeof val !== 'string' || !val.startsWith(PREFIX)) return val || '';
  try {
    const b = Buffer.from(val.slice(PREFIX.length), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', getKey(), b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
  } catch (e) { return ''; }
}
module.exports = { seal, open };
