/** Password policy and credential shape (ADR-016: scrypt hashes, never plaintext). */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

export class WeakPasswordError extends Error {
  constructor(reason: string) {
    super(`Password does not meet policy: ${reason}`);
    this.name = 'WeakPasswordError';
  }
}

export function assertPasswordPolicy(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new WeakPasswordError(`must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new WeakPasswordError(`must be at most ${MAX_PASSWORD_LENGTH} characters`);
  }
}

/**
 * A password hash plus the parameters needed to verify it. `hash` is the
 * scrypt-derived key encoded as base64; `salt` is the per-account salt.
 */
export interface PasswordHash {
  readonly algorithm: 'scrypt';
  readonly salt: string;
  readonly hash: string;
  readonly keyLength: number;
}

/**
 * Constant-time comparison helper. The credential adapter does the actual
 * scrypt work; this lives in the domain so verification semantics are testable
 * without native crypto.
 */
export function passwordHashMatches(hash: PasswordHash, encoded: string): boolean {
  const expected = `${hash.algorithm}:${hash.keyLength}:${hash.salt}:${hash.hash}`;
  return timingSafeEqualString(expected, encoded);
}

/** Length-preserving, constant-time string comparison (no early exit). */
export function timingSafeEqualString(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < max; i += 1) {
    const ca = a.charCodeAt(i) || 0;
    const cb = b.charCodeAt(i) || 0;
    mismatch |= ca ^ cb;
  }
  return mismatch === 0;
}
