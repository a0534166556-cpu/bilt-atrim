import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(String(password), salt, 64);
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (!stored?.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const derived = await scrypt(String(password), salt, 64);
  const hashBuf = Buffer.from(hash, 'hex');
  if (hashBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(hashBuf, derived);
}

export function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}
