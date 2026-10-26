import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { TrustedIdentityGuard } from './trusted-identity.guard';

function contextFor(headers: Record<string, string | string[] | undefined>, path: string): ExecutionContext {
  const request = { headers, path, url: path };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

interface CapturedUser {
  id?: string;
  email?: string;
  role?: string;
}

describe('TrustedIdentityGuard', () => {
  it('accepts requests anonymously in off mode', () => {
    const guard = new TrustedIdentityGuard('off');
    const context = contextFor({}, '/api/wallet-ledger/status');
    expect(guard.canActivate(context)).toBe(true);
    const request = context.switchToHttp().getRequest<{ user: CapturedUser }>();
    expect(request.user?.id).toBe('anonymous');
  });

  it('rejects missing identity in strict mode', () => {
    const guard = new TrustedIdentityGuard('strict');
    expect(() => guard.canActivate(contextFor({}, '/api/wallet-ledger/status'))).toThrow(
      UnauthorizedException,
    );
  });

  it('maps gateway headers to the user in strict mode', () => {
    const guard = new TrustedIdentityGuard('strict');
    const context = contextFor(
      { 'x-user-id': 'u-1', 'x-user-email': 'a@b.c', 'x-user-role': 'student' },
      '/api/admin-operation/status',
    );
    expect(guard.canActivate(context)).toBe(true);
    expect(context.switchToHttp().getRequest<{ user: CapturedUser }>().user).toEqual({
      id: 'u-1',
      email: 'a@b.c',
      role: 'student',
    });
  });

  it('takes the first value when a header arrives as an array', () => {
    const guard = new TrustedIdentityGuard('strict');
    const context = contextFor({ 'x-user-id': ['u-2', 'u-3'] }, '/api/live-class/status');
    expect(guard.canActivate(context)).toBe(true);
    expect(context.switchToHttp().getRequest<{ user: CapturedUser }>().user?.id).toBe('u-2');
  });

  it('skips health and docs paths even in strict mode', () => {
    const guard = new TrustedIdentityGuard('strict');
    for (const path of ['/api/health', '/api/docs', '/api/docs-json']) {
      const context = contextFor({}, path);
      expect(guard.canActivate(context)).toBe(true);
      expect(context.switchToHttp().getRequest<{ user: CapturedUser }>().user?.id).toBe('anonymous');
    }
  });

  it('lets the pre-session auth routes through even in strict mode (ADR-016)', () => {
    const guard = new TrustedIdentityGuard('strict');
    for (const path of [
      '/api/auth/register',
      '/api/auth/login',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/wallet/top-ups/callback',
    ]) {
      const context = contextFor({}, path);
      expect(guard.canActivate(context)).toBe(true);
      expect(context.switchToHttp().getRequest<{ user: CapturedUser }>().user?.id).toBe('anonymous');
    }
  });

  it('still requires identity for /api/auth/me in strict mode', () => {
    const guard = new TrustedIdentityGuard('strict');
    expect(() => guard.canActivate(contextFor({}, '/api/auth/me'))).toThrow();
  });

  /**
   * ADR-020 Amendment A: the Jitsi presence webhook authenticates with its own shared secret,
   * because Jitsi is not a user and cannot carry `x-user-*` headers.
   *
   * This case exists because the omission it guards was invisible until CI: local runs use
   * `AUTH_MODE=off`, where every request passes regardless, so the endpoint appeared to work
   * while being unreachable in any environment that actually authenticates.
   */
  it('lets the Jitsi presence webhook through in strict mode', () => {
    const guard = new TrustedIdentityGuard('strict');
    const context = contextFor({}, '/api/internal/jitsi/presence');
    expect(guard.canActivate(context)).toBe(true);
    expect(context.switchToHttp().getRequest<{ user: CapturedUser }>().user?.id).toBe('anonymous');
  });

  it('does not widen the public list to unrelated internal routes', () => {
    // The prefix is `/api/internal/jitsi`, not `/api/internal`: a future internal endpoint must
    // opt in deliberately rather than inherit this exemption from a broader prefix.
    const guard = new TrustedIdentityGuard('strict');
    expect(() => guard.canActivate(contextFor({}, '/api/internal/other'))).toThrow();
  });
});
