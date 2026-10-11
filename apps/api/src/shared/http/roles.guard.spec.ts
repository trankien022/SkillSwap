import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { RequestWithIdentity } from './identity';
import { RolesGuard } from './roles.guard';

function contextFor(user: RequestWithIdentity['user']): ExecutionContext {
  const request: RequestWithIdentity = { headers: {}, user };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

function guardWith(required: string[] | undefined): RolesGuard {
  const reflector = {
    getAllAndOverride: () => required,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard (FR-002 / NFR-009)', () => {
  it('allows a route with no @Roles metadata', () => {
    expect(guardWith(undefined).canActivate(contextFor({ id: 'u1' }))).toBe(true);
  });

  it('allows an identity carrying a required role', () => {
    expect(guardWith(['admin']).canActivate(contextFor({ id: 'a1', role: 'admin' }))).toBe(true);
  });

  it('forbids an identity with a different role', () => {
    expect(() => guardWith(['admin']).canActivate(contextFor({ id: 'u1', role: 'learner' }))).toThrow(
      ForbiddenException,
    );
  });

  it('requires a role when one is enforced', () => {
    expect(() => guardWith(['admin']).canActivate(contextFor({ id: 'u1' }))).toThrow(
      UnauthorizedException,
    );
  });
});
