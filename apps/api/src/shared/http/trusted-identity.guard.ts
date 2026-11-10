import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { isPublicPath } from '@skillswap/contracts';
import type { AuthMode } from '../config/api-config';
import { headerValue, type RequestWithIdentity } from './identity';

/**
 * The allow-list lives in `@skillswap/contracts` (ADR-042) because the gateway keeps
 * the same list. It used to be duplicated here and there, and a divergence in the
 * silent direction — public at the edge, protected at the API — is invisible.
 *
 * Entries are matched through `normalizeApiPath`, so both `/api/v1/auth/login` and the
 * legacy `/api/auth/login` are recognised from one list. `GET /api/auth/me` is
 * deliberately absent: it reads the trusted identity, so it needs a session.
 */

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

    if (isPublicPath(path)) {
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
