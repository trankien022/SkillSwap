import type { AuthApiPort } from './port/auth-api';
import type { SessionStorePort } from './port/session-store';
import {
  AuthenticationError,
  CorruptSessionError,
  SessionExpiredError,
  SessionExpiredRetryRequiredError,
  type ActiveSession,
  type LoginCredentials,
  type RegisterCredentials,
  type SessionTokens,
  type SessionUser,
} from './port/session-types';

function isInvalidRefreshSession(error: unknown): boolean {
  if (
    error instanceof AuthenticationError ||
    error instanceof SessionExpiredError
  ) {
    return true;
  }
  if (error === null || typeof error !== 'object') return false;

  const responseError = error as { statusCode?: unknown; message?: unknown };
  return (
    responseError.statusCode === 401 ||
    (responseError.statusCode === 404 &&
      typeof responseError.message === 'string' &&
      /account not found/i.test(responseError.message))
  );
}

export interface AuthenticatedCallOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

/**
 * Application service managing session lifecycle, token rotation, and persistence.
 *
 * Invariants:
 * - Pure structural types and ports only; no vendor/framework imports.
 * - Single-flight token refresh for concurrent 401/expired requests.
 * - Refresh token rotation saved to storage before resuming callers.
 * - Generation tracking and serialized persistence prevent in-flight writes
 *   (getMe, store.save, refresh, restore) from resurrecting stale sessions.
 * - Logout immediately invalidates memory state and guarantees storage is empty after older writes settle.
 * - No old login/refresh/restore can clear or overwrite a newer session.
 * - restoreSession only expires on authentic rejection (401); transport/server/storage errors remain visible.
 * - Never automatically replays POST / financial commands on 401.
 * - Login failure does not wipe an existing valid session.
 * - Injectable clock, no hidden network work in constructors.
 * - SecureStore failures remain visible and never leave false logged-in state.
 */
export class SessionService {
  private activeSession: ActiveSession | null = null;
  private generation = 0;
  private refreshFlightPromise: Promise<ActiveSession> | null = null;
  private persistenceQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly authApi: AuthApiPort,
    private readonly sessionStore: SessionStorePort,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  // ==========================================
  // Session Accessors
  // ==========================================

  getActiveSession(): ActiveSession | null {
    return this.activeSession;
  }

  isAuthenticated(): boolean {
    if (!this.activeSession) return false;
    return !this.isTokenExpired(this.activeSession.tokens, 0);
  }

  getAccessToken(): Promise<string> {
    return this.getValidAccessToken();
  }

  async getValidAccessToken(bufferMs = 15000): Promise<string> {
    if (!this.activeSession) {
      throw new SessionExpiredError('No active session found');
    }

    if (this.isTokenExpired(this.activeSession.tokens, bufferMs)) {
      const refreshed = await this.refreshSession();
      return refreshed.tokens.accessToken;
    }

    return this.activeSession.tokens.accessToken;
  }

  isTokenExpired(tokens: SessionTokens, bufferMs = 15000): boolean {
    return tokens.expiresAt <= this.clock() + bufferMs;
  }

  // ==========================================
  // Lifecycle & Authentication Commands
  // ==========================================

  /**
   * Restores a previously persisted session on application bootstrap.
   * Generation-fenced before and after every asynchronous stage.
   * Only authentic auth rejections (401) expire persisted session;
   * transport/server/storage errors remain visible.
   */
  async restoreSession(): Promise<ActiveSession | null> {
    const opGen = this.generation;

    let stored: ActiveSession | null;
    try {
      stored = await this.runSerializedStoreOp(async () => {
        if (this.generation !== opGen) return null;
        return await this.sessionStore.load();
      });
    } catch (error) {
      if (error instanceof CorruptSessionError) {
        if (this.generation === opGen) {
          this.activeSession = null;
          await this.runSerializedStoreOp(async () => {
            if (this.generation === opGen) {
              await this.sessionStore.clear();
            }
          });
        }
        return null;
      }
      // Native storage read failures must remain visible
      throw error;
    }

    if (this.generation !== opGen) {
      return null;
    }

    if (!stored) {
      if (this.generation === opGen) {
        this.activeSession = null;
      }
      return null;
    }

    // If access token is expired, attempt refreshing using stored refresh token
    if (this.isTokenExpired(stored.tokens, 0)) {
      if (this.generation !== opGen) {
        return null;
      }

      this.activeSession = stored;

      try {
        const refreshed = await this.refreshSession();
        if (this.generation !== opGen) {
          return null;
        }
        return refreshed;
      } catch (refreshErr) {
        const isAuthRejection = isInvalidRefreshSession(refreshErr);

        if (isAuthRejection) {
          if (this.generation === opGen) {
            this.activeSession = null;
            await this.runSerializedStoreOp(async () => {
              if (this.generation === opGen) {
                await this.sessionStore.clear();
              }
            });
          }
          return null;
        }

        // Temporary network/server outage must NOT clear persisted credentials!
        throw refreshErr;
      }
    }

    if (this.generation !== opGen) {
      return null;
    }

    this.activeSession = stored;
    return stored;
  }

  async register(credentials: RegisterCredentials): Promise<ActiveSession> {
    const opGen = ++this.generation;

    const rawTokens = await this.authApi.register(credentials);

    if (this.generation !== opGen) {
      throw new SessionExpiredError('Registration operation was aborted');
    }

    const expiresAt = this.clock() + rawTokens.expiresIn * 1000;
    const initialSession: ActiveSession = {
      tokens: {
        accessToken: rawTokens.accessToken,
        refreshToken: rawTokens.refreshToken,
        expiresAt,
        tokenType: rawTokens.tokenType,
      },
    };

    try {
      await this.runSerializedStoreOp(async () => {
        if (this.generation === opGen) {
          await this.sessionStore.save(initialSession);
        }
      });
    } catch (storageError) {
      if (this.generation === opGen) {
        this.activeSession = null;
      }
      throw storageError;
    }

    if (this.generation !== opGen) {
      throw new SessionExpiredError('Registration was aborted during storage');
    }

    this.activeSession = initialSession;

    // Fetch user profile with generation fencing before and after network/storage
    let user: SessionUser | undefined;
    try {
      user = await this.authApi.getMe(rawTokens.accessToken);
    } catch {
      // Non-critical profile summary fetch failure
    }

    if (this.generation !== opGen) {
      throw new SessionExpiredError('Registration operation was superseded');
    }

    if (user !== undefined) {
      const enrichedSession: ActiveSession = { ...initialSession, user };
      try {
        await this.runSerializedStoreOp(async () => {
          if (this.generation === opGen) {
            await this.sessionStore.save(enrichedSession);
          }
        });
      } catch (storageError) {
        if (this.generation === opGen) {
          this.activeSession = null;
        }
        throw storageError;
      }
      if (this.generation !== opGen) {
        throw new SessionExpiredError('Registration was aborted during profile storage');
      }
      this.activeSession = enrichedSession;
      return enrichedSession;
    }

    return initialSession;
  }

  async login(credentials: LoginCredentials): Promise<ActiveSession> {
    const opGen = ++this.generation;

    // Do not wipe previous session before call completes (prevents login failure wiping valid session)
    const rawTokens = await this.authApi.login(credentials);

    if (this.generation !== opGen) {
      throw new SessionExpiredError('Login operation was aborted');
    }

    const expiresAt = this.clock() + rawTokens.expiresIn * 1000;
    const initialSession: ActiveSession = {
      tokens: {
        accessToken: rawTokens.accessToken,
        refreshToken: rawTokens.refreshToken,
        expiresAt,
        tokenType: rawTokens.tokenType,
      },
    };

    try {
      await this.runSerializedStoreOp(async () => {
        if (this.generation === opGen) {
          await this.sessionStore.save(initialSession);
        }
      });
    } catch (storageError) {
      if (this.generation === opGen) {
        this.activeSession = null;
      }
      throw storageError;
    }

    if (this.generation !== opGen) {
      throw new SessionExpiredError('Login was aborted during storage');
    }

    this.activeSession = initialSession;

    // Fetch user profile with generation fencing before and after network/storage
    let user: SessionUser | undefined;
    try {
      user = await this.authApi.getMe(rawTokens.accessToken);
    } catch {
      // Non-critical profile summary fetch failure
    }

    if (this.generation !== opGen) {
      throw new SessionExpiredError('Login operation was superseded');
    }

    if (user !== undefined) {
      const enrichedSession: ActiveSession = { ...initialSession, user };
      try {
        await this.runSerializedStoreOp(async () => {
          if (this.generation === opGen) {
            await this.sessionStore.save(enrichedSession);
          }
        });
      } catch (storageError) {
        if (this.generation === opGen) {
          this.activeSession = null;
        }
        throw storageError;
      }
      if (this.generation !== opGen) {
        throw new SessionExpiredError('Login was aborted during profile storage');
      }
      this.activeSession = enrichedSession;
      return enrichedSession;
    }

    return initialSession;
  }

  /**
   * Refreshes the active session.
   * Single-flight execution for concurrent requests.
   * Saves rotated refresh token before resuming callers.
   * Rejects resurrection if logout occurred during in-flight refresh.
   */
  async refreshSession(): Promise<ActiveSession> {
    if (this.refreshFlightPromise) {
      return this.refreshFlightPromise;
    }

    const opGen = this.generation;
    const currentRefreshToken = this.activeSession?.tokens.refreshToken;

    if (!currentRefreshToken) {
      throw new SessionExpiredError('No refresh token available to refresh session');
    }

    const flightPromise = (async () => {
      try {
        const newTokens = await this.authApi.refresh(currentRefreshToken);

        if (this.generation !== opGen) {
          throw new SessionExpiredError('Session was terminated during token refresh');
        }

        const expiresAt = this.clock() + newTokens.expiresIn * 1000;
        const updatedSession: ActiveSession = {
          tokens: {
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
            expiresAt,
            tokenType: newTokens.tokenType,
          },
          user: this.activeSession?.user,
        };

        // CRITICAL: Refresh token rotation saved to store BEFORE resuming callers
        try {
          await this.runSerializedStoreOp(async () => {
            if (this.generation === opGen) {
              await this.sessionStore.save(updatedSession);
            }
          });
        } catch (storageError) {
          // Storage failure after rotation: session is unusable (old refresh token revoked on server)
          if (this.generation === opGen) {
            this.activeSession = null;
            try {
              await this.runSerializedStoreOp(async () => {
                if (this.generation === opGen) {
                  await this.sessionStore.clear();
                }
              });
            } catch {
              // ignore secondary clear error
            }
          }
          throw storageError;
        }

        if (this.generation !== opGen) {
          throw new SessionExpiredError('Session was terminated during token storage');
        }

        this.activeSession = updatedSession;
        return updatedSession;
      } catch (error) {
        const isAuthRejection =
          error instanceof AuthenticationError ||
          error instanceof SessionExpiredError ||
          (error !== null &&
            typeof error === 'object' &&
            'statusCode' in error &&
            (error as { statusCode?: number }).statusCode === 401);

        if (isAuthRejection && this.generation === opGen) {
          this.activeSession = null;
          await this.runSerializedStoreOp(async () => {
            if (this.generation === opGen) {
              await this.sessionStore.clear();
            }
          });
        }
        throw error;
      }
    })();

    this.refreshFlightPromise = flightPromise;
    try {
      return await flightPromise;
    } finally {
      if (this.refreshFlightPromise === flightPromise) {
        this.refreshFlightPromise = null;
      }
    }
  }

  async logout(): Promise<void> {
    const logoutGen = ++this.generation;
    const refreshToken = this.activeSession?.tokens.refreshToken;

    // Immediately invalidate activeSession and in-flight refresh flight
    this.activeSession = null;
    this.refreshFlightPromise = null;

    try {
      if (refreshToken) {
        await this.authApi.logout(refreshToken);
      }
    } finally {
      if (this.generation === logoutGen) {
        this.activeSession = null;
      }
      // Serialized clear runs AFTER any in-flight older storage writes settle
      await this.runSerializedStoreOp(async () => {
        // Guard against wiping a newer session if user logged in during logout network call
        if (this.generation === logoutGen) {
          await this.sessionStore.clear();
        }
      });
    }
  }

  async getMe(): Promise<SessionUser> {
    const opGen = this.generation;
    const token = await this.getValidAccessToken();

    if (this.generation !== opGen) {
      throw new SessionExpiredError('Session was terminated before profile request');
    }

    const user = await this.authApi.getMe(token);

    if (this.generation !== opGen) {
      throw new SessionExpiredError('Session was terminated during profile request');
    }

    if (this.activeSession) {
      const updated = { ...this.activeSession, user };
      this.activeSession = updated;
      await this.runSerializedStoreOp(async () => {
        if (this.generation === opGen) {
          await this.sessionStore.save(updated);
        }
      });
    }

    if (this.generation !== opGen) {
      throw new SessionExpiredError('Session was terminated during profile persistence');
    }

    return user;
  }

  /**
   * Executes an authenticated action with token management:
   * - Retries eligible GET operations at most once on 401 after token refresh.
   * - NEVER automatically replays POST / state-changing commands on 401; throws
   *   SessionExpiredRetryRequiredError for caller to safely reconcile using idempotency.
   */
  async executeAuthenticated<T>(
    action: (accessToken: string) => Promise<T>,
    options: AuthenticatedCallOptions = { method: 'GET' },
  ): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase();
    const token = await this.getValidAccessToken();

    try {
      return await action(token);
    } catch (error) {
      const isUnauthorized =
        (error !== null &&
          typeof error === 'object' &&
          'statusCode' in error &&
          (error as { statusCode?: number }).statusCode === 401) ||
        error instanceof AuthenticationError ||
        error instanceof SessionExpiredError;

      if (!isUnauthorized) {
        throw error;
      }

      if (method !== 'GET') {
        throw new SessionExpiredRetryRequiredError(
          `Session expired during ${method} command. Automatic replay suppressed; reconcile with idempotency key.`,
        );
      }

      const refreshed = await this.refreshSession();
      return await action(refreshed.tokens.accessToken);
    }
  }

  // ==========================================
  // Private Storage Serialization
  // ==========================================

  private async runSerializedStoreOp<T>(op: () => Promise<T>): Promise<T> {
    const previousQueue = this.persistenceQueue;
    let releaseCurrent: () => void = () => {};

    this.persistenceQueue = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });

    try {
      await previousQueue;
    } catch {
      // Continue even if previous storage operation failed
    }

    try {
      return await op();
    } finally {
      releaseCurrent();
    }
  }
}
