import type { IncomingHttpHeaders } from 'node:http';

/** Claims the gateway verified and injects as trusted headers (ADR-011). */
export interface GatewayIdentity {
  id: string;
  email?: string;
  role?: string;
}

export const TRUSTED_HEADERS = ['x-user-id', 'x-user-email', 'x-user-role'] as const;

export class AuthError extends Error {
  constructor(
    readonly statusCode: 401 | 500,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Clients can never set identity headers themselves — strip them first. */
export function stripIdentityHeaders(headers: IncomingHttpHeaders): void {
  for (const name of TRUSTED_HEADERS) delete headers[name];
}

export function injectIdentityHeaders(headers: IncomingHttpHeaders, identity: GatewayIdentity): void {
  headers['x-user-id'] = identity.id;
  if (identity.email !== undefined) headers['x-user-email'] = identity.email;
  if (identity.role !== undefined) headers['x-user-role'] = identity.role;
}

export function bearerToken(authorization: string | string[] | undefined): string | undefined {
  if (typeof authorization !== 'string') return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1];
}
