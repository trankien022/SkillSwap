import type { Session } from '../../../domain/session';

export const SESSION_REPOSITORY = Symbol('SessionRepository');

export interface NewSession {
  readonly accountId: string;
  readonly refreshTokenHash: string;
  readonly expiresAt: string;
}

export interface SessionRepository {
  create(input: NewSession): Promise<Session>;
  findByTokenHash(refreshTokenHash: string): Promise<Session | null>;
  revoke(id: string): Promise<void>;
  revokeAllForAccount(accountId: string): Promise<void>;
}
