import type { PasswordHash } from '../../../domain/credential';

export const PASSWORD_HASHER = Symbol('PasswordHasher');

export interface PasswordHasher {
  /** Derives a salted scrypt hash for a new password. */
  hash(plaintext: string): Promise<PasswordHash>;
  /** Constant-time verification against a stored hash. */
  verify(plaintext: string, stored: PasswordHash): Promise<boolean>;
}
