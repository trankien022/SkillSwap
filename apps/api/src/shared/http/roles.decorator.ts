import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'skillswap:roles';

/**
 * FR-001 primitive reused by FR-002: restrict a route (or controller) to the
 * given trusted identity roles. Enforced by `RolesGuard`, which reads the role
 * the gateway put in the trusted identity.
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
