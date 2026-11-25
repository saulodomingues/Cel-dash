// Senha do /admin (scrypt) e sessões em memória.
import crypto from 'node:crypto';
import { getSecrets, saveSecrets } from './config.js';

const sessions = new Map(); // id -> expira (ms)
const TTL = 30 * 24 * 3600 * 1000;
const fails = { n: 0, until: 0 };

function hash(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

export const hasPassword = () => Boolean(getSecrets().admin?.hash);

export function setPassword(password) {
  if (typeof password !== 'string' || password.length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.');
  const salt = crypto.randomBytes(16).toString('hex');
  saveSecrets({ ...getSecrets(), admin: { salt, hash: hash(password, salt) } });
}

export function checkPassword(password) {
  if (Date.now() < fails.until) throw new Error('Muitas tentativas. Espere um minuto.');
  const a = getSecrets().admin;
  const ok = Boolean(a?.hash) && typeof password === 'string' &&
    crypto.timingSafeEqual(Buffer.from(hash(password, a.salt), 'hex'), Buffer.from(a.hash, 'hex'));
  if (ok) { fails.n = 0; return true; }
  if (++fails.n >= 5) { fails.n = 0; fails.until = Date.now() + 60_000; }
  return false;
}

export function createSession() {
  const id = crypto.randomBytes(24).toString('hex');
  sessions.set(id, Date.now() + TTL);
  return id;
}

export function dropSession(id) { sessions.delete(id); }
export function dropAllSessions() { sessions.clear(); }

export function sessionFrom(req) {
  const m = /(?:^|;\s*)sid=([a-f0-9]{48})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const exp = sessions.get(m[1]);
  if (!exp || exp < Date.now()) { sessions.delete(m[1]); return null; }
  return m[1];
}

export const cookieFor = (id) => `sid=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL / 1000}`;
export const clearCookie = () => 'sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
