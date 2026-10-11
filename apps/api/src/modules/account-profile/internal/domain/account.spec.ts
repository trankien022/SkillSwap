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

  it('accepts known roles and rejects unknown/legacy ones', () => {
    expect(() => assertAccountRole('user')).not.toThrow();
    expect(() => assertAccountRole('verifier')).not.toThrow();
    expect(() => assertAccountRole('admin')).not.toThrow();
    expect(() => assertAccountRole('superuser')).toThrow(InvalidAccountRoleError);
    // learner/teacher are capabilities, not roles (ADR-030).
    expect(() => assertAccountRole('learner')).toThrow(InvalidAccountRoleError);
    expect(() => assertAccountRole('teacher')).toThrow(InvalidAccountRoleError);
  });

  it('restricts self-registration to the ordinary user role (ADR-030)', () => {
    expect(isSelfRegistrationRole('user')).toBe(true);
    expect(isSelfRegistrationRole('verifier')).toBe(false);
    expect(isSelfRegistrationRole('admin')).toBe(false);
  });

  it('only lets active accounts sign in', () => {
    expect(() => assertAccountCanSignIn('active')).not.toThrow();
    expect(() => assertAccountCanSignIn('suspended')).toThrow(AccountSuspendedError);
  });
});
