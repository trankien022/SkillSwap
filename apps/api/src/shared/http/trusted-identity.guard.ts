import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthMode } from '../config/api-config';
import { headerValue, type RequestWithIdentity } from './identity';

const PUBLIC_PREFIXES = [
  '/api/health',
  '/api/docs',
  '/api/docs-json',
  // FR-001 / ADR-016: reachable before a session exists. `GET /api/auth/me`
  // is intentionally NOT public — it reads the trusted identity.
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  // FR-008 / ADR-017: the provider callback is authenticated by its HMAC
  // signature, not a user session.
  '/api/wallet/top-ups/callback',
];

/**
 * In strict mode, accepts the X-User-* headers injected by the trusted
 * gateway; in off mode, treats every request as an anonymous identity so
 * local development and tests need no gateway.
 */
@Injectable()
export class TrustedIdentityGuard implements CanActivate {
  constructor(private readonly authMode: AuthMode) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithIdentity>();
    const path = request.path ?? request.url ?? '';

    if (PUBLIC_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
      request.user = { id: 'anonymous' };
      return true;
    }

    const id = headerValue(request.headers, 'x-user-id');

    if (this.authMode === 'strict') {
      if (id === undefined || id === '') {
        throw new UnauthorizedException('Missing x-user-id header');
      }
    } else if (id === undefined || id === '') {
      request.user = { id: 'anonymous' };
      return true;
    }

    request.user = {
      id,
      email: headerValue(request.headers, 'x-user-email'),
      role: headerValue(request.headers, 'x-user-role'),
    };
    return true;
  }
}
