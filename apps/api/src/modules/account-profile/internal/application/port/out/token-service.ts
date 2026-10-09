import type { AccountRole } from '../../../domain/account';

export const TOKEN_SERVICE = Symbol('TokenService');

export interface AccessTokenInput {
  readonly accountId: string;
  readonly email: string;
  readonly role: AccountRole;
}

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresInSeconds: number;
}

/** RS256 access-token issuance and the opaque refresh-token helpers (ADR-016). */
export interface TokenService {
  issueAccessToken(input: AccessTokenInput): IssuedAccessToken;
  /** Generates a new opaque refresh token (raw value returned only here). */
  newRefreshToken(): string;
  /** Hashes a raw refresh token for storage/lookup. */
  hashRefreshToken(raw: string): string;
}

export const CLOCK = Symbol('Clock');

export interface Clock {
  now(): Date;
}
