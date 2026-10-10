import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RequestWithIdentity } from './identity';
import { ROLES_KEY } from './roles.decorator';

/**
 * FR-001 primitive reused by FR-002 (NFR-009): enforces `@Roles(...)` against
 * the trusted identity role. A route with no `@Roles` is unaffected; a route
 * with `@Roles` requires an authenticated identity carrying one of the roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithIdentity>();
    const role = request.user?.role;
    if (role === undefined || role === '') {
      throw new UnauthorizedException('Authentication with a role is required');
    }
    if (!required.includes(role)) {
      throw new ForbiddenException(`Requires one of roles: ${required.join(', ')}`);
    }
    return true;
  }
}
