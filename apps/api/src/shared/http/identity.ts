import type { IncomingHttpHeaders } from 'node:http';

/** Identity injected by the gateway as trusted headers (ADR-011). */
export interface AuthenticatedUser {
  id: string;
  email?: string;
  role?: string;
}

/** Structural request view — the app never imports express. */
export interface RequestWithIdentity {
  headers: IncomingHttpHeaders;
  user?: AuthenticatedUser;
  path?: string;
  url?: string;
  method?: string;
  body?: unknown;
}

export function headerValue(headers: IncomingHttpHeaders, name: string): string | undefined {
  const raw = headers[name];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return undefined;
}

export function currentUserId(request: RequestWithIdentity): string {
  return request.user?.id ?? 'anonymous';
}
