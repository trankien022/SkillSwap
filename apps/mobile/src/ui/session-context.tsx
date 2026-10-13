import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { defaultKeyValueStore } from '@/infrastructure/storage/key-value-store';
import type {
  ActiveSession,
  LoginCredentials,
  RegisterCredentials,
  SessionUser,
} from '@/application/port/session-types';
import { SessionService } from '@/application/session-service';
import { defaultLocale, translator, type Locale } from '@/i18n';
import {
  ConfigurationError,
  resolveMobileConfig,
  type MobileConfig,
} from '@/infrastructure/config';
import {
  GatewayClient,
  type SessionTokenProvider,
} from '@/infrastructure/http/gateway-client';
import { SecureSessionStore } from '@/infrastructure/storage/secure-session-store';
import { createCoordinatedTokenProvider } from './coordinated-token-provider';
import { PUSH_DEVICE_ID_KEY, unregisterPushDevice } from '@/infrastructure/push/notification-device-lifecycle';

export interface SessionContextValue {
  readonly session: ActiveSession | null;
  readonly user: SessionUser | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  readonly bootError: Error | null;
  readonly configError: ConfigurationError | null;
  readonly locale: Locale;
  readonly localeReady: boolean;
  readonly setLocale: (locale: Locale) => void;
  readonly t: (key: string, vars?: Record<string, string | number>) => string;
  readonly login: (credentials: LoginCredentials) => Promise<void>;
  readonly register: (credentials: RegisterCredentials) => Promise<void>;
  readonly logout: () => Promise<void>;
  readonly refreshMe: () => Promise<SessionUser>;
  readonly retryBoot: () => void;
  readonly gatewayClient: GatewayClient | null;
  readonly sessionService: SessionService | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export interface SessionProviderProps {
  readonly children: React.ReactNode;
  readonly initialLocale?: Locale;
  readonly injectedGateway?: GatewayClient;
  readonly injectedSessionService?: SessionService;
}

export function SessionProvider({
  children,
  initialLocale = defaultLocale,
  injectedGateway,
  injectedSessionService,
}: SessionProviderProps) {
  const [locale, updateLocale] = useState<Locale>(initialLocale);
  const [localeReady, setLocaleReady] = useState(false);
  const localeChanged = useRef(false);
  const localeWrite = useRef<Promise<unknown>>(Promise.resolve());
  const setLocale = useCallback((next: Locale) => {
    localeChanged.current = true;
    updateLocale(next);
    localeWrite.current = localeWrite.current.catch(() => undefined).then(() => defaultKeyValueStore().setItemAsync('skillswap.locale', next));
    void localeWrite.current.catch(() => undefined);
  }, []);
  useEffect(() => {
    let active = true;
    void defaultKeyValueStore().getItemAsync('skillswap.locale').then((saved) => {
      if (active && !localeChanged.current && (saved === 'vi' || saved === 'en')) updateLocale(saved);
    }).catch(() => undefined).finally(() => { if (active) setLocaleReady(true); });
    return () => { active = false; };
  }, []);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [bootError, setBootError] = useState<Error | null>(null);

  const uiGenerationRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 1. Resolve mobile config safely as a pure computation
  const { resolvedConfig, configError } = useMemo<{
    resolvedConfig: MobileConfig | null;
    configError: ConfigurationError | null;
  }>(() => {
    try {
      const cfg = resolveMobileConfig();
      return { resolvedConfig: cfg, configError: null };
    } catch (err) {
      const error =
        err instanceof ConfigurationError
          ? err
          : new ConfigurationError(String(err));
      return { resolvedConfig: null, configError: error };
    }
  }, []);

  // 2. Instantiate dependencies if not injected
  const gatewayClient = useMemo<GatewayClient | null>(() => {
    if (injectedGateway) return injectedGateway;
    if (!resolvedConfig) return null;
    return new GatewayClient(resolvedConfig);
  }, [injectedGateway, resolvedConfig]);

  const sessionService = useMemo<SessionService | null>(() => {
    if (injectedSessionService) return injectedSessionService;
    if (!gatewayClient) return null;
    const store = new SecureSessionStore();
    return new SessionService(gatewayClient, store);
  }, [injectedSessionService, gatewayClient]);

  // 3. Coordinated token provider: syncs authoritative service session state after requests/refresh
  const coordinatedTokenProvider = useMemo<SessionTokenProvider | null>(() => {
    if (!sessionService) return null;
    return createCoordinatedTokenProvider(sessionService, {
      getUiGeneration: () => uiGenerationRef.current,
      isMounted: () => isMountedRef.current,
      onSessionSync: (syncedSession) => {
        setSession(syncedSession);
      },
    });
  }, [sessionService]);

  // Wire token provider via effect only (no render-time mutation)
  useEffect(() => {
    if (gatewayClient && coordinatedTokenProvider) {
      gatewayClient.setTokenProvider(coordinatedTokenProvider);
    }
  }, [gatewayClient, coordinatedTokenProvider]);

  // 4. Boot restoration with generation fence & error visibility
  const runBootRestore = useCallback(async () => {
    if (!sessionService) {
      setIsLoading(false);
      return;
    }

    const currentGen = ++uiGenerationRef.current;
    setIsLoading(true);
    setBootError(null);

    try {
      const restored = await sessionService.restoreSession();
      if (isMountedRef.current && uiGenerationRef.current === currentGen) {
        setSession(restored);
        setIsLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current && uiGenerationRef.current === currentGen) {
        setBootError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      }
    }
  }, [sessionService]);

  useEffect(() => {
    if (configError) {
      setIsLoading(false);
      return;
    }
    void runBootRestore();
  }, [runBootRestore, configError]);

  // 5. Auth actions with generation guards
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      if (!sessionService) throw new Error('SessionService not initialized');
      const currentGen = ++uiGenerationRef.current;
      const res = await sessionService.login(credentials);
      if (isMountedRef.current && uiGenerationRef.current === currentGen) {
        setSession(res);
      }
    },
    [sessionService],
  );

  const register = useCallback(
    async (credentials: RegisterCredentials) => {
      if (!sessionService) throw new Error('SessionService not initialized');
      const currentGen = ++uiGenerationRef.current;
      const res = await sessionService.register(credentials);
      if (isMountedRef.current && uiGenerationRef.current === currentGen) {
        setSession(res);
      }
    },
    [sessionService],
  );

  const logout = useCallback(async () => {
    if (!sessionService) return;
    const pushDeviceId = await defaultKeyValueStore().getItemAsync(PUSH_DEVICE_ID_KEY);
    if (pushDeviceId) {
      if (!gatewayClient) throw new Error('Cannot deactivate push device without an authenticated Gateway');
      // Keep the session active if server-side deactivation fails so the user can retry.
      await unregisterPushDevice(gatewayClient);
    }
    ++uiGenerationRef.current;
    setSession(null);
    await sessionService.logout();
  }, [gatewayClient, sessionService]);

  const refreshMe = useCallback(async () => {
    if (!sessionService) throw new Error('SessionService not initialized');
    const currentGen = uiGenerationRef.current;
    try {
      // getMe uses the raw auth port; its GET retry belongs to SessionService.
      // Business requests use GatewayClient.authenticatedRequest directly.
      return await sessionService.executeAuthenticated(() => sessionService.getMe());
    } finally {
      if (isMountedRef.current && uiGenerationRef.current === currentGen) {
        setSession(sessionService.getActiveSession());
      }
    }
  }, [sessionService]);

  const t = useMemo(() => translator(locale), [locale]);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      isLoading,
      bootError,
      configError,
      locale,
      localeReady,
      setLocale,
      t,
      login,
      register,
      logout,
      refreshMe,
      retryBoot: runBootRestore,
      gatewayClient,
      sessionService,
    }),
    [
      session,
      isLoading,
      bootError,
      configError,
      locale,
      localeReady,
      t,
      login,
      register,
      logout,
      refreshMe,
      runBootRestore,
      gatewayClient,
      sessionService,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
