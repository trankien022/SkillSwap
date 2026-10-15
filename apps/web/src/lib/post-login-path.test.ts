import { describe, expect, it } from 'vitest';
import { postLoginPath, resolvePostLoginPath } from './post-login-path';

/**
 * Regression for the reported bug: `AuthForm` redirected every role to
 * `/classes`, so an admin or verifier signed in and landed on a marketplace
 * with no entry to their own screens.
 */
describe('postLoginPath', () => {
  it('sends an admin to the admin landing', () => {
    expect(postLoginPath('admin', 'vi')).toBe('/vi/admin');
    expect(postLoginPath('admin', 'en')).toBe('/en/admin');
  });

  it('sends a verifier to their queue', () => {
    expect(postLoginPath('verifier', 'vi')).toBe('/vi/verifier');
    expect(postLoginPath('verifier', 'en')).toBe('/en/verifier');
  });

  it('sends learners (and anyone unknown) to the marketplace', () => {
    expect(postLoginPath('user', 'vi')).toBe('/vi/classes');
    expect(postLoginPath(undefined, 'vi')).toBe('/vi/classes');
    expect(postLoginPath('something-new', 'vi')).toBe('/vi/classes');
  });
});

describe('resolvePostLoginPath', () => {
  it('prefers an explicit returnUrl over the role default', () => {
    expect(
      resolvePostLoginPath({
        role: 'admin',
        locale: 'vi',
        returnUrl: '/vi/admin/student-verifications',
      }),
    ).toBe('/vi/admin/student-verifications');
  });

  it('falls back to the role landing when no returnUrl was given', () => {
    expect(resolvePostLoginPath({ role: 'verifier', locale: 'vi' })).toBe('/vi/verifier');
    expect(resolvePostLoginPath({ role: 'verifier', locale: 'vi', returnUrl: null })).toBe(
      '/vi/verifier',
    );
  });

  it('refuses to redirect off-site (open redirect)', () => {
    expect(
      resolvePostLoginPath({ role: 'user', locale: 'vi', returnUrl: 'https://evil.example/phish' }),
    ).toBe('/vi/classes');
    expect(
      resolvePostLoginPath({ role: 'user', locale: 'vi', returnUrl: '//evil.example/phish' }),
    ).toBe('/vi/classes');
  });
});
