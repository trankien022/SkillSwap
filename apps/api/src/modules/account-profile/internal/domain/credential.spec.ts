import {
  assertPasswordPolicy,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  passwordHashMatches,
  timingSafeEqualString,
  WeakPasswordError,
} from './credential';

describe('credential domain', () => {
  it('enforces the password length boundaries', () => {
    expect(() => assertPasswordPolicy('x'.repeat(MIN_PASSWORD_LENGTH - 1))).toThrow(WeakPasswordError);
    expect(() => assertPasswordPolicy('x'.repeat(MIN_PASSWORD_LENGTH))).not.toThrow();
    expect(() => assertPasswordPolicy('x'.repeat(MAX_PASSWORD_LENGTH))).not.toThrow();
    expect(() => assertPasswordPolicy('x'.repeat(MAX_PASSWORD_LENGTH + 1))).toThrow(WeakPasswordError);
  });

  it('matches an encoded hash and rejects a different one', () => {
    const hash = { algorithm: 'scrypt' as const, salt: 's', hash: 'h', keyLength: 64 };
    const encoded = 'scrypt:64:s:h';
    expect(passwordHashMatches(hash, encoded)).toBe(true);
    expect(passwordHashMatches(hash, 'scrypt:64:s:other')).toBe(false);
  });

  it('compares strings in constant time', () => {
    expect(timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(timingSafeEqualString('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualString('', '')).toBe(true);
  });
});
