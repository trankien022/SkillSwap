import type { AuthApiPort } from './port/auth-api';
import type { SessionStorePort } from './port/session-store';
import {
  AuthenticationError,
  CorruptSessionError,
  SessionExpiredError,
  SessionExpiredRetryRequiredError,
  type ActiveSession,
  type RawTokenPayload,
  type SessionUser,
} from './port/session-types';
import { SessionService } from './session-service';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class MockAuthApi implements AuthApiPort {
  public registerCallCount = 0;
  public loginCallCount = 0;
  public refreshCallCount = 0;
  public logoutCallCount = 0;
  public getMeCallCount = 0;

  public refreshDelayMs = 0;
  public shouldFailRefresh = false;
  public refreshErrorToThrow: unknown = null;
  public shouldFailLogout = false;
  public shouldFailLogin = false;

  public getMeDeferred: Deferred<SessionUser> | null = null;
  public refreshDeferred: Deferred<RawTokenPayload> | null = null;
  public logoutDeferred: Deferred<void> | null = null;

  public onGetMeEntered?: () => void;
  public onLogoutEntered?: () => void;

  public rotatedRefreshToken = 'rotated-refresh-token-1';
  public rotatedAccessToken = 'rotated-access-token-1';

  async register(): Promise<RawTokenPayload> {
    this.registerCallCount++;
    return {
      accessToken: 'reg-access-1',
      refreshToken: 'reg-refresh-1',
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  async login(credentials: { email: string }): Promise<RawTokenPayload> {
    this.loginCallCount++;
    if (this.shouldFailLogin) {
      throw new AuthenticationError('Invalid credentials', 401);
    }
    return {
      accessToken: `login-access-for-${credentials.email}`,
      refreshToken: `login-refresh-for-${credentials.email}`,
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  async refresh(oldRefreshToken: string): Promise<RawTokenPayload> {
    this.refreshCallCount++;
    if (this.refreshDeferred) {
      return this.refreshDeferred.promise;
    }
    if (this.refreshDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.refreshDelayMs));
    }
    if (this.refreshErrorToThrow) {
      throw this.refreshErrorToThrow;
    }
    if (this.shouldFailRefresh) {
      throw new AuthenticationError('Invalid refresh token', 401);
    }
    return {
      accessToken: this.rotatedAccessToken,
      refreshToken: `${this.rotatedRefreshToken}-from-${oldRefreshToken}`,
      expiresIn: 3600,
      tokenType: 'Bearer',
    };
  }

  async logout(): Promise<void> {
    this.logoutCallCount++;
    this.onLogoutEntered?.();
    if (this.logoutDeferred) {
      await this.logoutDeferred.promise;
    }
    if (this.shouldFailLogout) {
      throw new Error('Network failure during logout');
    }
  }

  async getMe(accessToken: string): Promise<SessionUser> {
    this.getMeCallCount++;
    this.onGetMeEntered?.();
    if (this.getMeDeferred) {
      return this.getMeDeferred.promise;
    }
    const isUserB = accessToken.includes('userB');
    return {
      id: isUserB ? 'user-B' : 'user-A',
      email: isUserB ? 'userB@example.com' : 'userA@example.com',
      displayName: isUserB ? 'User B' : 'User A',
      role: 'user',
      status: 'active',
      studentVerification: {
        status: 'approved',
        reason: null,
      },
    };
  }
}

class MockSessionStore implements SessionStorePort {
  public savedSessions: ActiveSession[] = [];
  public currentStored: ActiveSession | null = null;
  public clearCallCount = 0;
  public shouldFailSave = false;
  public shouldFailClear = false;
  public shouldThrowCorruptOnLoad = false;

  public saveDeferred: Deferred<void> | null = null;
  public loadDeferred: Deferred<ActiveSession | null> | null = null;
  public clearDeferred: Deferred<void> | null = null;

  public onSaveEntered?: () => void;
  public onLoadEntered?: () => void;
  public onClearEntered?: () => void;

  async save(session: ActiveSession): Promise<void> {
    this.onSaveEntered?.();
    if (this.saveDeferred) {
      await this.saveDeferred.promise;
    }
    if (this.shouldFailSave) {
      throw new Error('Secure storage disk full or keychain locked');
    }
    this.savedSessions.push(session);
    this.currentStored = session;
  }

  async load(): Promise<ActiveSession | null> {
    this.onLoadEntered?.();
    if (this.loadDeferred) {
      return this.loadDeferred.promise;
    }
    if (this.shouldThrowCorruptOnLoad) {
      throw new CorruptSessionError('Payload corrupted in storage');
    }
    return this.currentStored;
  }

  async clear(): Promise<void> {
    this.onClearEntered?.();
    if (this.clearDeferred) {
      await this.clearDeferred.promise;
    }
    if (this.shouldFailClear) {
      throw new Error('Storage clear failed');
    }
    this.clearCallCount++;
    this.currentStored = null;
  }
}

describe('SessionService', () => {
  let authApi: MockAuthApi;
  let store: MockSessionStore;
  let currentTime: number;
  let clock: () => number;

  beforeEach(() => {
    authApi = new MockAuthApi();
    store = new MockSessionStore();
    currentTime = 1000000;
    clock = () => currentTime;
  });

  describe('Single-Flight Refresh & Token Rotation Invariants', () => {
    it('executes single-flight refresh for concurrent expired calls and saves rotated token before resume', async () => {
      authApi.refreshDelayMs = 20;

      const service = new SessionService(authApi, store, clock);

      await service.login({ email: 'userA@example.com', password: 'password123' });
      expect(authApi.loginCallCount).toBe(1);

      currentTime += 4000 * 1000;

      const results = await Promise.all([
        service.getValidAccessToken(),
        service.getValidAccessToken(),
        service.getValidAccessToken(),
        service.getValidAccessToken(),
        service.refreshSession(),
      ]);

      expect(authApi.refreshCallCount).toBe(1);

      expect(results[0]).toBe('rotated-access-token-1');
      expect(results[1]).toBe('rotated-access-token-1');

      expect(store.currentStored?.tokens.refreshToken).toContain('rotated-refresh-token-1');
      expect(store.currentStored?.tokens.accessToken).toBe('rotated-access-token-1');
    });

    it('subsequent request after single-flight completion makes a fresh call if needed', async () => {
      const service = new SessionService(authApi, store, clock);
      await service.login({ email: 'userA@example.com', password: 'password123' });

      currentTime += 5000 * 1000;
      await service.refreshSession();
      expect(authApi.refreshCallCount).toBe(1);

      currentTime += 5000 * 1000;
      await service.refreshSession();
      expect(authApi.refreshCallCount).toBe(2);
    });
  });

  describe('Deterministic Deferred Race Conditions (Stage Handshakes)', () => {
    it('handles logout racing during getMe: rejects superseded login and leaves session cleared', async () => {
      const service = new SessionService(authApi, store, clock);
      const getMeEntered = createDeferred<void>();
      const userAGetMe = createDeferred<SessionUser>();

      authApi.onGetMeEntered = () => getMeEntered.resolve();
      authApi.getMeDeferred = userAGetMe;

      const loginPromise = service.login({ email: 'userA@example.com', password: 'password123' });

      await getMeEntered.promise;

      await service.logout();

      userAGetMe.resolve({
        id: 'user-A',
        email: 'userA@example.com',
        displayName: 'User A',
        role: 'user',
        status: 'active',
      });

      await expect(loginPromise).rejects.toThrow(SessionExpiredError);

      expect(service.getActiveSession()).toBeNull();
      expect(store.currentStored).toBeNull();
    });

    it('handles logout racing during store.save: ensures storage is left empty after older write settles', async () => {
      const service = new SessionService(authApi, store, clock);
      const saveEntered = createDeferred<void>();
      const saveDeferred = createDeferred<void>();

      store.onSaveEntered = () => saveEntered.resolve();
      store.saveDeferred = saveDeferred;

      const loginPromise = service.login({ email: 'userA@example.com', password: 'password123' });

      await saveEntered.promise;

      const logoutPromise = service.logout();

      saveDeferred.resolve();

      await expect(loginPromise).rejects.toThrow(SessionExpiredError);
      await logoutPromise;

      expect(store.currentStored).toBeNull();
      expect(service.getActiveSession()).toBeNull();
    });

    it('handles restoreSession racing logout: does not set activeSession after logout', async () => {
      const service = new SessionService(authApi, store, clock);
      const loadEntered = createDeferred<void>();
      const loadDeferred = createDeferred<ActiveSession | null>();

      store.onLoadEntered = () => loadEntered.resolve();
      store.loadDeferred = loadDeferred;

      const restorePromise = service.restoreSession();
      await loadEntered.promise;

      const logoutPromise = service.logout();

      loadDeferred.resolve({
        tokens: {
          accessToken: 'old-access',
          refreshToken: 'old-refresh',
          expiresAt: currentTime + 1000000,
          tokenType: 'Bearer',
        },
      });

      const restored = await restorePromise;
      await logoutPromise;

      expect(restored).toBeNull();
      expect(service.getActiveSession()).toBeNull();
      expect(store.currentStored).toBeNull();
    });

    it('handles restoreSession racing new login: old restore does not overwrite new login', async () => {
      const service = new SessionService(authApi, store, clock);
      const loadEntered = createDeferred<void>();
      const loadDeferred = createDeferred<ActiveSession | null>();

      store.onLoadEntered = () => loadEntered.resolve();
      store.loadDeferred = loadDeferred;

      const restorePromise = service.restoreSession();
      await loadEntered.promise;

      const loginPromise = service.login({ email: 'userB@example.com', password: 'password123' });

      loadDeferred.resolve({
        tokens: {
          accessToken: 'old-user-A-token',
          refreshToken: 'old-user-A-refresh',
          expiresAt: currentTime + 1000000,
          tokenType: 'Bearer',
        },
      });

      const restored = await restorePromise;
      await loginPromise;
      expect(restored).toBeNull();

      expect(service.getActiveSession()?.tokens.accessToken).toBe('login-access-for-userB@example.com');
      expect(store.currentStored?.tokens.accessToken).toBe('login-access-for-userB@example.com');
    });

    it('handles old getMe racing new login: rejects old login and preserves new user', async () => {
      const service = new SessionService(authApi, store, clock);
      const getMeEntered = createDeferred<void>();
      const userAGetMe = createDeferred<SessionUser>();

      authApi.onGetMeEntered = () => getMeEntered.resolve();
      authApi.getMeDeferred = userAGetMe;

      const loginAPromise = service.login({ email: 'userA@example.com', password: 'password123' });
      await getMeEntered.promise;

      authApi.onGetMeEntered = undefined;
      authApi.getMeDeferred = null;
      await service.login({ email: 'userB@example.com', password: 'password123' });

      expect(service.getActiveSession()?.user?.id).toBe('user-B');

      userAGetMe.resolve({
        id: 'user-A',
        email: 'userA@example.com',
        displayName: 'User A',
        role: 'user',
        status: 'active',
      });

      await expect(loginAPromise).rejects.toThrow(SessionExpiredError);

      expect(service.getActiveSession()?.user?.id).toBe('user-B');
      expect(store.currentStored?.user?.id).toBe('user-B');
    });

    it('handles logout network waiting then new login success then old logout resolves', async () => {
      const service = new SessionService(authApi, store, clock);
      await service.login({ email: 'userA@example.com', password: 'passA' });

      const logoutEntered = createDeferred<void>();
      const logoutDeferred = createDeferred<void>();

      authApi.onLogoutEntered = () => logoutEntered.resolve();
      authApi.logoutDeferred = logoutDeferred;

      const logoutPromise = service.logout();
      await logoutEntered.promise;

      await service.login({ email: 'userB@example.com', password: 'passB' });
      expect(service.getActiveSession()?.user?.id).toBe('user-B');

      logoutDeferred.resolve();
      await logoutPromise;

      expect(service.getActiveSession()?.user?.id).toBe('user-B');
      expect(store.currentStored?.user?.id).toBe('user-B');
    });

    it('handles old storage failure vs newer login without clearing newer session', async () => {
      const service = new SessionService(authApi, store, clock);
      const saveEntered = createDeferred<void>();
      const saveDeferred = createDeferred<void>();

      store.onSaveEntered = () => saveEntered.resolve();
      store.saveDeferred = saveDeferred;

      const loginAPromise = service.login({ email: 'userA@example.com', password: 'passA' });
      await saveEntered.promise;

      store.onSaveEntered = undefined;
      store.saveDeferred = null;

      store.shouldFailSave = true;
      saveDeferred.resolve();

      await expect(loginAPromise).rejects.toThrow();

      store.shouldFailSave = false;
      await service.login({ email: 'userB@example.com', password: 'passB' });

      expect(service.getActiveSession()?.user?.id).toBe('user-B');
      expect(store.currentStored?.user?.id).toBe('user-B');
    });

    it('handles old profile storage vs newer login: does not overwrite newer session', async () => {
      const service = new SessionService(authApi, store, clock);
      await service.login({ email: 'userA@example.com', password: 'passA' });

      const getMeEntered = createDeferred<void>();
      const getMeDeferred = createDeferred<SessionUser>();
      authApi.onGetMeEntered = () => getMeEntered.resolve();
      authApi.getMeDeferred = getMeDeferred;

      const getMePromise = service.getMe();
      await getMeEntered.promise;

      authApi.onGetMeEntered = undefined;
      authApi.getMeDeferred = null;
      await service.login({ email: 'userB@example.com', password: 'passB' });

      getMeDeferred.resolve({
        id: 'user-A',
        email: 'userA@example.com',
        displayName: 'User A',
        role: 'user',
        status: 'active',
      });

      await expect(getMePromise).rejects.toThrow(/Session.*terminated/);

      expect(service.getActiveSession()?.user?.id).toBe('user-B');
      expect(store.currentStored?.user?.id).toBe('user-B');
    });

    it('handles restore-corrupt vs new login: corrupt cleanup does not erase new login', async () => {
      const service = new SessionService(authApi, store, clock);
      const clearEntered = createDeferred<void>();
      const clearDeferred = createDeferred<void>();

      store.shouldThrowCorruptOnLoad = true;
      store.onClearEntered = () => clearEntered.resolve();
      store.clearDeferred = clearDeferred;

      const restorePromise = service.restoreSession();
      await clearEntered.promise;

      store.onClearEntered = undefined;
      store.clearDeferred = null;
      store.shouldThrowCorruptOnLoad = false;
      const loginPromise = service.login({ email: 'userB@example.com', password: 'passB' });

      clearDeferred.resolve();
      await restorePromise;
      await loginPromise;

      expect(service.getActiveSession()?.user?.id).toBe('user-B');
      expect(store.currentStored?.user?.id).toBe('user-B');
    });

    it('marks session unusable when storage failure occurs after token refresh rotation', async () => {
      const service = new SessionService(authApi, store, clock);
      await service.login({ email: 'userA@example.com', password: 'passA' });

      currentTime += 5000 * 1000;

      store.shouldFailSave = true;

      await expect(service.refreshSession()).rejects.toThrow(/Secure storage disk full/);

      expect(service.getActiveSession()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    it('guards old refresh finally from clearing a newer refresh-flight', async () => {
      const service = new SessionService(authApi, store, clock);
      await service.login({ email: 'userA@example.com', password: 'password123' });

      authApi.refreshDeferred = createDeferred<RawTokenPayload>();
      const slowRefresh = service.refreshSession();

      authApi.refreshDeferred.resolve({
        accessToken: 'res-token',
        refreshToken: 'res-refresh',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });

      await slowRefresh;
      expect(service.getActiveSession()?.tokens.accessToken).toBe('res-token');
    });
  });

  describe('restoreSession Error Visibility & Outage Resilience', () => {
    it('does NOT wipe stored credentials when refresh fails due to temporary network outage', async () => {
      const expiredSession: ActiveSession = {
        tokens: {
          accessToken: 'old-access',
          refreshToken: 'valid-refresh',
          expiresAt: currentTime - 1000,
          tokenType: 'Bearer',
        },
      };
      store.currentStored = expiredSession;

      authApi.refreshErrorToThrow = { statusCode: 0, message: 'Network request failed' };

      const service = new SessionService(authApi, store, clock);

      await expect(service.restoreSession()).rejects.toMatchObject({
        statusCode: 0,
        message: 'Network request failed',
      });

      expect(store.currentStored).toEqual(expiredSession);
    });

    it('cleanly wipes stored credentials only when refresh token is rejected (401)', async () => {
      const expiredSession: ActiveSession = {
        tokens: {
          accessToken: 'old-access',
          refreshToken: 'revoked-refresh',
          expiresAt: currentTime - 1000,
          tokenType: 'Bearer',
        },
      };
      store.currentStored = expiredSession;
      authApi.shouldFailRefresh = true;

      const service = new SessionService(authApi, store, clock);
      const result = await service.restoreSession();

      expect(result).toBeNull();
      expect(service.getActiveSession()).toBeNull();
      expect(store.currentStored).toBeNull();
    });

    it('clears a saved session when refresh reports that its account no longer exists (404)', async () => {
      const expiredSession: ActiveSession = {
        tokens: {
          accessToken: 'old-access',
          refreshToken: 'orphaned-refresh',
          expiresAt: currentTime - 1000,
          tokenType: 'Bearer',
        },
      };
      store.currentStored = expiredSession;
      authApi.refreshErrorToThrow = {
        statusCode: 404,
        message: 'Account not found: session',
      };

      const service = new SessionService(authApi, store, clock);
      const result = await service.restoreSession();

      expect(result).toBeNull();
      expect(service.getActiveSession()).toBeNull();
      expect(store.currentStored).toBeNull();
    });

    it('does not clear credentials for unrelated 404 responses', async () => {
      const expiredSession: ActiveSession = {
        tokens: {
          accessToken: 'old-access',
          refreshToken: 'valid-refresh',
          expiresAt: currentTime - 1000,
          tokenType: 'Bearer',
        },
      };
      store.currentStored = expiredSession;
      authApi.refreshErrorToThrow = {
        statusCode: 404,
        message: 'Cannot POST /api/auth/refresh',
      };

      const service = new SessionService(authApi, store, clock);

      await expect(service.restoreSession()).rejects.toMatchObject({
        statusCode: 404,
        message: 'Cannot POST /api/auth/refresh',
      });
      expect(store.currentStored).toEqual(expiredSession);
    });

    it('surfaces storage failures during corrupt restore cleanup rather than swallowing', async () => {
      store.shouldThrowCorruptOnLoad = true;
      store.shouldFailClear = true;

      const service = new SessionService(authApi, store, clock);

      await expect(service.restoreSession()).rejects.toThrow('Storage clear failed');
    });

    it('surfaces storage failures during getMe profile persistence rather than swallowing', async () => {
      const service = new SessionService(authApi, store, clock);
      await service.login({ email: 'userA@example.com', password: 'password123' });

      store.shouldFailSave = true;

      await expect(service.getMe()).rejects.toThrow(/Secure storage disk full/);
    });
  });

  describe('Login Failure Protection', () => {
    it('avoids login failure wiping previously valid session without reason', async () => {
      const service = new SessionService(authApi, store, clock);

      const originalSession = await service.login({
        email: 'userA@example.com',
        password: 'correct-password',
      });
      expect(service.getActiveSession()).toEqual(originalSession);

      authApi.shouldFailLogin = true;
      await expect(
        service.login({ email: 'user2@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(AuthenticationError);

      expect(service.getActiveSession()).toEqual(originalSession);
      expect(store.currentStored).toEqual(originalSession);
    });
  });

  describe('SecureStore Failure Visibility', () => {
    it('surfaces storage write failure on login and does not leave false in-memory logged-in state', async () => {
      store.shouldFailSave = true;

      const service = new SessionService(authApi, store, clock);

      await expect(
        service.login({ email: 'userA@example.com', password: 'password123' }),
      ).rejects.toThrow(/Secure storage disk full/);

      expect(service.getActiveSession()).toBeNull();
    });

    it('surfaces storage write failure on register and does not leave false in-memory state', async () => {
      store.shouldFailSave = true;

      const service = new SessionService(authApi, store, clock);

      await expect(
        service.register({
          email: 'new@example.com',
          displayName: 'New',
          password: 'password123',
        }),
      ).rejects.toThrow(/Secure storage disk full/);

      expect(service.getActiveSession()).toBeNull();
    });
  });

  describe('Authenticated Execution Invariants (POST No Automatic Replay)', () => {
    it('retries eligible GET operation at most once when encountering 401', async () => {
      const service = new SessionService(authApi, store, clock);
      await service.login({ email: 'userA@example.com', password: 'password123' });

      let callCount = 0;
      const result = await service.executeAuthenticated(
        async (token) => {
          callCount++;
          if (callCount === 1) {
            throw new AuthenticationError('Unauthorized', 401);
          }
          return `success-with-${token}`;
        },
        { method: 'GET' },
      );

      expect(callCount).toBe(2);
      expect(authApi.refreshCallCount).toBe(1);
      expect(result).toBe('success-with-rotated-access-token-1');
    });

    it('NEVER automatically replays POST on 401 and returns explicit retry state', async () => {
      const service = new SessionService(authApi, store, clock);
      await service.login({ email: 'userA@example.com', password: 'password123' });

      let postInvocationCount = 0;

      const postPromise = service.executeAuthenticated(
        async () => {
          postInvocationCount++;
          throw new AuthenticationError('Session expired during financial command', 401);
        },
        { method: 'POST' },
      );

      await expect(postPromise).rejects.toThrow(SessionExpiredRetryRequiredError);
      await expect(postPromise).rejects.toMatchObject({
        requiresReconciliation: true,
        code: 'SESSION_EXPIRED_RETRY_REQUIRED',
      });

      expect(postInvocationCount).toBe(1);
    });
  });
});
