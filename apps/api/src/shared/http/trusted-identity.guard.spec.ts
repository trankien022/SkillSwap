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
    for (const path of ['/api/auth/register', '/api/auth/login', '/api/auth/refresh', '/api/auth/logout']) {
      const context = contextFor({}, path);
      expect(guard.canActivate(context)).toBe(true);
      expect(context.switchToHttp().getRequest<{ user: CapturedUser }>().user?.id).toBe('anonymous');
    }
  });

  it('still requires identity for /api/auth/me in strict mode', () => {
    const guard = new TrustedIdentityGuard('strict');
    expect(() => guard.canActivate(contextFor({}, '/api/auth/me'))).toThrow();
  });
});
