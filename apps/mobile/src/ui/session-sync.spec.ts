import type { ActiveSession } from '@/application/port/session-types';
import type { SessionTokenProvider } from '@/infrastructure/http/gateway-client';
import {
  createCoordinatedTokenProvider,
  type AuthoritativeSessionService,
} from './coordinated-token-provider';

describe('createCoordinatedTokenProvider', () => {
  let mockSessionService: jest.Mocked<AuthoritativeSessionService>;

  beforeEach(() => {
    mockSessionService = {
      getAccessToken: jest.fn(),
      refreshSession: jest.fn(),
      getActiveSession: jest.fn(),
    };
  });

  it('synchronizes authoritative active session when getAccessToken succeeds', async () => {
    const uiGen = { current: 1 };
    const isMounted = { current: true };
    const stateUpdates: (ActiveSession | null)[] = [];

    const activeSession: ActiveSession = {
      tokens: {
        accessToken: 'active-token',
        refreshToken: 'active-refresh',
        expiresAt: Date.now() + 60000,
        tokenType: 'Bearer',
      },
    };

    mockSessionService.getAccessToken.mockResolvedValueOnce('active-token');
    mockSessionService.getActiveSession.mockReturnValue(activeSession);

    const provider: SessionTokenProvider = createCoordinatedTokenProvider(mockSessionService, {
      getUiGeneration: () => uiGen.current,
      isMounted: () => isMounted.current,
      onSessionSync: (sess) => stateUpdates.push(sess),
    });

    const token = await provider.getAccessToken();

    expect(token).toBe('active-token');
    expect(stateUpdates).toHaveLength(1);
    expect(stateUpdates[0]).toEqual(activeSession);
  });

  it('synchronizes invalidated session (null) when getAccessToken detects expired session', async () => {
    const uiGen = { current: 1 };
    const isMounted = { current: true };
    const stateUpdates: (ActiveSession | null)[] = [];

    mockSessionService.getAccessToken.mockRejectedValueOnce(new Error('SessionExpiredError'));
    mockSessionService.getActiveSession.mockReturnValue(null);

    const provider = createCoordinatedTokenProvider(mockSessionService, {
      getUiGeneration: () => uiGen.current,
      isMounted: () => isMounted.current,
      onSessionSync: (sess) => stateUpdates.push(sess),
    });

    await expect(provider.getAccessToken()).rejects.toThrow('SessionExpiredError');

    expect(stateUpdates).toHaveLength(1);
    expect(stateUpdates[0]).toBeNull();
  });

  it('preserves and propagates existing session when getAccessToken encounters network outage', async () => {
    const uiGen = { current: 1 };
    const isMounted = { current: true };
    const stateUpdates: (ActiveSession | null)[] = [];

    const preservedSession: ActiveSession = {
      tokens: {
        accessToken: 'cached-token',
        refreshToken: 'cached-refresh',
        expiresAt: Date.now() + 60000,
        tokenType: 'Bearer',
      },
    };

    mockSessionService.getAccessToken.mockRejectedValueOnce(
      new Error('Network request failed: Gateway unreachable'),
    );
    mockSessionService.getActiveSession.mockReturnValue(preservedSession);

    const provider = createCoordinatedTokenProvider(mockSessionService, {
      getUiGeneration: () => uiGen.current,
      isMounted: () => isMounted.current,
      onSessionSync: (sess) => stateUpdates.push(sess),
    });

    await expect(provider.getAccessToken()).rejects.toThrow('Gateway unreachable');

    expect(stateUpdates).toHaveLength(1);
    expect(stateUpdates[0]).toEqual(preservedSession);
  });

  it('synchronizes refreshed session when explicit refreshSession succeeds', async () => {
    const uiGen = { current: 1 };
    const isMounted = { current: true };
    const stateUpdates: (ActiveSession | null)[] = [];

    const rotatedSession: ActiveSession = {
      tokens: {
        accessToken: 'rotated-access',
        refreshToken: 'rotated-refresh',
        expiresAt: Date.now() + 900000,
        tokenType: 'Bearer',
      },
    };

    mockSessionService.refreshSession.mockResolvedValueOnce(rotatedSession);
    mockSessionService.getActiveSession.mockReturnValue(rotatedSession);

    const provider = createCoordinatedTokenProvider(mockSessionService, {
      getUiGeneration: () => uiGen.current,
      isMounted: () => isMounted.current,
      onSessionSync: (sess) => stateUpdates.push(sess),
    });

    const result = await provider.refreshSession();

    expect(result).toEqual(rotatedSession);
    expect(stateUpdates).toHaveLength(1);
    expect(stateUpdates[0]).toEqual(rotatedSession);
  });

  it('clears session when explicit refreshSession fails with authentication rejection', async () => {
    const uiGen = { current: 1 };
    const isMounted = { current: true };
    const stateUpdates: (ActiveSession | null)[] = [];

    mockSessionService.refreshSession.mockRejectedValueOnce(
      new Error('401 Refresh token revoked'),
    );
    mockSessionService.getActiveSession.mockReturnValue(null);

    const provider = createCoordinatedTokenProvider(mockSessionService, {
      getUiGeneration: () => uiGen.current,
      isMounted: () => isMounted.current,
      onSessionSync: (sess) => stateUpdates.push(sess),
    });

    await expect(provider.refreshSession()).rejects.toThrow('401');

    expect(stateUpdates).toHaveLength(1);
    expect(stateUpdates[0]).toBeNull();
  });

  it('suppresses state update when logout occurs during in-flight refresh (generation increment)', async () => {
    const uiGen = { current: 1 };
    const isMounted = { current: true };
    const stateUpdates: (ActiveSession | null)[] = [];

    let resolveRefresh!: (session: ActiveSession) => void;
    mockSessionService.refreshSession.mockImplementation(
      () =>
        new Promise<ActiveSession>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const provider = createCoordinatedTokenProvider(mockSessionService, {
      getUiGeneration: () => uiGen.current,
      isMounted: () => isMounted.current,
      onSessionSync: (sess) => stateUpdates.push(sess),
    });

    const refreshPromise = provider.refreshSession();

    // User logs out concurrently: generation increments
    uiGen.current = 2;
    mockSessionService.getActiveSession.mockReturnValue(null);

    resolveRefresh({
      tokens: {
        accessToken: 'stale-token',
        refreshToken: 'stale-refresh',
        expiresAt: Date.now() + 900000,
        tokenType: 'Bearer',
      },
    });

    await refreshPromise;

    // Must NOT have called onSessionSync since generation changed
    expect(stateUpdates).toHaveLength(0);
  });

  it('suppresses state update when new login occurs during in-flight getAccessToken', async () => {
    const uiGen = { current: 1 };
    const isMounted = { current: true };
    const stateUpdates: (ActiveSession | null)[] = [];

    let resolveToken!: (token: string) => void;
    mockSessionService.getAccessToken.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveToken = resolve;
        }),
    );

    const provider = createCoordinatedTokenProvider(mockSessionService, {
      getUiGeneration: () => uiGen.current,
      isMounted: () => isMounted.current,
      onSessionSync: (sess) => stateUpdates.push(sess),
    });

    const tokenPromise = provider.getAccessToken();

    // New login occurs concurrently: generation increments
    uiGen.current = 2;

    resolveToken('old-token');
    await tokenPromise;

    expect(stateUpdates).toHaveLength(0);
  });

  it('suppresses state update if component has unmounted before request completes', async () => {
    const uiGen = { current: 1 };
    const isMounted = { current: true };
    const stateUpdates: (ActiveSession | null)[] = [];

    let resolveRefresh!: (session: ActiveSession) => void;
    mockSessionService.refreshSession.mockImplementation(
      () =>
        new Promise<ActiveSession>((resolve) => {
          resolveRefresh = resolve;
        }),
    );

    const provider = createCoordinatedTokenProvider(mockSessionService, {
      getUiGeneration: () => uiGen.current,
      isMounted: () => isMounted.current,
      onSessionSync: (sess) => stateUpdates.push(sess),
    });

    const refreshPromise = provider.refreshSession();

    // Unmount occurs
    isMounted.current = false;

    resolveRefresh({
      tokens: {
        accessToken: 'unmounted-token',
        refreshToken: 'unmounted-refresh',
        expiresAt: Date.now() + 900000,
        tokenType: 'Bearer',
      },
    });

    await refreshPromise;

    expect(stateUpdates).toHaveLength(0);
  });
});
