/**
 * Pure structural types and domain errors for the mobile session and authentication domain.
 * No framework, vendor, or external package imports are permitted in this layer.
 */

export type AccountRole = 'user' | 'verifier' | 'admin';

export type AccountVerificationStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Normalized absolute unix timestamp in milliseconds when accessToken expires */
  readonly expiresAt: number;
  readonly tokenType: 'Bearer';
}

export interface StudentVerificationSummary {
  readonly status: AccountVerificationStatus;
  readonly reason: string | null;
}

export interface SessionUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: AccountRole;
  readonly status: string;
  readonly studentVerification?: StudentVerificationSummary | null;
}

export interface ActiveSession {
  readonly tokens: SessionTokens;
  readonly user?: SessionUser;
}

export interface RegisterCredentials {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
  readonly role?: 'user';
}

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface RawTokenPayload {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Expiration period in seconds as returned by backend REST API */
  readonly expiresIn: number;
  readonly tokenType: 'Bearer';
}

/**
 * Thrown when an authentication attempt fails (e.g. invalid credentials).
 */
export class AuthenticationError extends Error {
  readonly statusCode: number;
  constructor(message = 'Authentication failed', statusCode = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
  }
}

/**
 * Thrown when a session is missing, invalid, or expired and cannot be refreshed.
 */
export class SessionExpiredError extends Error {
  readonly statusCode: number;
  constructor(message = 'Session expired. Please sign in again.', statusCode = 401) {
    super(message);
    this.name = 'SessionExpiredError';
    this.statusCode = statusCode;
  }
}

/**
 * Thrown when an operation (such as a POST / financial command) encounters
 * an authentication expiration and MUST NOT be automatically replayed.
 * Carries explicit state for caller to safely reconcile using an idempotency key.
 */
export class SessionExpiredRetryRequiredError extends Error {
  readonly statusCode = 401;
  readonly requiresReconciliation = true;
  readonly code = 'SESSION_EXPIRED_RETRY_REQUIRED' as const;

  constructor(
    message = 'Session expired during command execution. Automatic replay suppressed; reconcile with idempotency key.',
  ) {
    super(message);
    this.name = 'SessionExpiredRetryRequiredError';
  }
}

/**
 * Thrown when stored session data is unparseable or has an invalid schema.
 */
export class CorruptSessionError extends Error {
  constructor(message = 'Stored session data is corrupt or malformed', override readonly cause?: unknown) {
    super(message);
    this.name = 'CorruptSessionError';
  }
}
