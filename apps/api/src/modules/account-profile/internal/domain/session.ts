/** Refresh-session model and lifecycle (ADR-016: single-use rotating tokens, hashed at rest). */

export interface Session {
  readonly id: string;
  readonly accountId: string;
  /** SHA-256 hex of the opaque refresh token — the raw token is never stored. */
  readonly refreshTokenHash: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly createdAt: string;
}

export class SessionExpiredError extends Error {
  constructor() {
    super('The refresh session has expired');
    this.name = 'SessionExpiredError';
  }
}

export class SessionRevokedError extends Error {
  constructor() {
    super('The refresh session has been revoked');
    this.name = 'SessionRevokedError';
  }
}

export function isSessionActive(session: Session, now: Date): boolean {
  if (session.revokedAt !== null) {
    return false;
  }
  return new Date(session.expiresAt).getTime() > now.getTime();
}

export function assertSessionActive(session: Session, now: Date): void {
  if (session.revokedAt !== null) {
    throw new SessionRevokedError();
  }
  if (!isSessionActive(session, now)) {
    throw new SessionExpiredError();
  }
}

export function addMilliseconds(from: Date, ms: number): Date {
  return new Date(from.getTime() + ms);
}
