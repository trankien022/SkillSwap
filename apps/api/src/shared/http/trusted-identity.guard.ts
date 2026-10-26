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
  // FR-011 / FR-020 / ADR-020 Amendment A: the Jitsi `event_sync` webhook
  // cannot carry user headers — Jitsi is not a user. It authenticates itself
  // with its own shared secret (`x-jitsi-webhook-secret`, compared in constant
  // time), so requiring a trusted identity on top would make the endpoint
  // unreachable in strict mode. It was reachable by accident only because local
  // development runs `AUTH_MODE=off`, where every request would have passed
  // regardless; CI found it the first time the endpoint was exercised with real
  // auth. Being public here means "no user session", not "no authentication".
  '/api/internal/jitsi',
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
