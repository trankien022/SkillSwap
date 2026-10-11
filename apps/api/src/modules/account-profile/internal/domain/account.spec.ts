import {
  AccountSuspendedError,
  assertAccountCanSignIn,
  assertAccountRole,
  InvalidAccountRoleError,
  isSelfRegistrationRole,
  normalizeEmail,
} from './account';

describe('account domain', () => {
  it('normalizes emails to trimmed lowercase', () => {
    expect(normalizeEmail('  An@Example.COM ')).toBe('an@example.com');
  });

  it('accepts known roles and rejects unknown ones', () => {
    expect(() => assertAccountRole('learner')).not.toThrow();
    expect(() => assertAccountRole('teacher')).not.toThrow();
    expect(() => assertAccountRole('verifier')).not.toThrow();
    expect(() => assertAccountRole('admin')).not.toThrow();
    expect(() => assertAccountRole('superuser')).toThrow(InvalidAccountRoleError);
  });

  it('restricts self-registration to learner/teacher (ADR-029)', () => {
    expect(isSelfRegistrationRole('learner')).toBe(true);
    expect(isSelfRegistrationRole('teacher')).toBe(true);
    expect(isSelfRegistrationRole('verifier')).toBe(false);
    expect(isSelfRegistrationRole('admin')).toBe(false);
  });

  it('only lets active accounts sign in', () => {
    expect(() => assertAccountCanSignIn('active')).not.toThrow();
    expect(() => assertAccountCanSignIn('suspended')).toThrow(AccountSuspendedError);
  });
});
