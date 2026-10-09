import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHash } from '../../../domain/credential';
import type { PasswordHasher } from '../../../application/port/out/password-hasher';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** scrypt password hashing via node:crypto (ADR-016: no extra dependency). */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<PasswordHash> {
    const salt = randomBytes(SALT_BYTES).toString('base64');
    const derived = (await scryptAsync(plaintext, salt, KEY_LENGTH)) as Buffer;
    return { algorithm: 'scrypt', salt, hash: derived.toString('base64'), keyLength: KEY_LENGTH };
  }

  async verify(plaintext: string, stored: PasswordHash): Promise<boolean> {
    const derived = (await scryptAsync(plaintext, stored.salt, stored.keyLength)) as Buffer;
    const expected = Buffer.from(stored.hash, 'base64');
    if (expected.length !== derived.length) {
      return false;
    }
    return timingSafeEqual(expected, derived);
  }
}
