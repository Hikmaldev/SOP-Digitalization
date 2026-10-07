import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SCHEME = 'scrypt';

/**
 * Hash a password with scrypt (built into Node, no native dependencies).
 * Stored format: `scrypt$<salt-hex>$<hash-hex>`.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(plain, salt, KEY_LENGTH);
  return `${SCHEME}$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, salt, expectedHex] = stored.split('$');
  if (scheme !== SCHEME || !salt || !expectedHex) return false;

  const derived = await scryptAsync(plain, salt, KEY_LENGTH);
  const expected = Buffer.from(expectedHex, 'hex');
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
