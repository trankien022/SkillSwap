import type { WalletBalanceView } from '@skillswap/contracts';

// Use empty string on client side so it hits Next.js rewrites, avoiding CORS
export const API = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000');

export const TOKEN_STORAGE_KEY = 'skillswap-api-tokens';
export const USER_STORAGE_KEY = 'skillswap-api-user';
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  rememberUntil?: number;
}

export interface UserProfile {
  id?: string;
  email: string;
  displayName: string;
  role?: string;
  studentVerificationStatus?: string;
}

export interface SessionInfo {
  tokens: TokenPair;
  remembered: boolean;
}

let refreshInFlight: Promise<TokenPair | null> | null = null;

export function readSession(): SessionInfo | null {
  if (typeof window === 'undefined') return null;

  for (const storage of [window.sessionStorage, window.localStorage]) {
    const raw = storage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) continue;

    try {
      const value: TokenPair = JSON.parse(raw);
      if (!value?.accessToken || !value?.refreshToken) {
        storage.removeItem(TOKEN_STORAGE_KEY);
        continue;
      }
      if (value.rememberUntil && Date.now() >= value.rememberUntil) {
        storage.removeItem(TOKEN_STORAGE_KEY);
        continue;
      }
      return {
        tokens: value,
        remembered: storage === window.localStorage,
      };
    } catch {
      storage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
  return null;
}

export function getTokens(): TokenPair | null {
  return readSession()?.tokens ?? null;
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(USER_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

export function saveTokens(pair: { accessToken: string; refreshToken: string }, remembered = false): void {
  if (!pair?.accessToken || !pair?.refreshToken) {
    throw new Error('Tokens received from backend are invalid.');
  }

  const value: TokenPair = {
    accessToken: pair.accessToken,
    refreshToken: pair.refreshToken,
    ...(remembered ? { rememberUntil: Date.now() + REMEMBER_MS } : {}),
  };

  if (typeof window === 'undefined') return;

  const target = remembered ? window.localStorage : window.sessionStorage;
  const other = remembered ? window.sessionStorage : window.localStorage;

  other.removeItem(TOKEN_STORAGE_KEY);
  target.setItem(TOKEN_STORAGE_KEY, JSON.stringify(value));
}

export function getStoredUser(): UserProfile | null {
  if (typeof window === 'undefined') return null;

  for (const storage of [window.sessionStorage, window.localStorage]) {
    const raw = storage.getItem(USER_STORAGE_KEY);
    if (!raw) continue;

    try {
      return JSON.parse(raw);
    } catch {
      storage.removeItem(USER_STORAGE_KEY);
    }
  }
  return null;
}

export function saveStoredUser(user: Partial<UserProfile>, remembered = false): void {
  if (typeof window === 'undefined') return;

  const target = remembered ? window.localStorage : window.sessionStorage;
  const other = remembered ? window.sessionStorage : window.localStorage;

  other.removeItem(USER_STORAGE_KEY);
  target.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export async function refreshSession(): Promise<TokenPair | null> {
  const current = getTokens();
  if (!current?.refreshToken) {
    clearSession();
    throw new Error('No refresh token available');
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });

      if (!res.ok) {
        clearSession();
        throw new Error('Session expired');
      }

      const data = await unwrapEnvelope<{ accessToken: string; refreshToken: string }>(res);
      const remembered = readSession()?.remembered ?? false;
      saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }, remembered);
      return { accessToken: data.accessToken, refreshToken: data.refreshToken };
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function callApi(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const session = getTokens();
  const token = session?.accessToken;

  const res = await fetch(`${API}/api${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retry && session?.refreshToken) {
    try {
      await refreshSession();
      return callApi(path, init, false);
    } catch {
      return res;
    }
  }

  return res;
}

import { unwrapEnvelope, type ApiEnvelope } from '@skillswap/contracts';

/**
 * NFR-013: the envelope runtime layer is shared from `@skillswap/contracts` so web, mobile and any
 * other client parse responses identically. Re-exported here so existing imports keep working;
 * transport concerns (base URL, auth, retry) stay in this file.
 *
 * `ApiError` is kept as a local alias of the shared `ApiResponseError` for call sites/tests that
 * import it from here (the `contracts` package already uses `ApiError` for the legacy
 * `apiErrorSchema` type, so the class is named `ApiResponseError` at the source).
 */
export { unwrapEnvelope, type ApiEnvelope, type ApiErrorItem } from '@skillswap/contracts';
export { ApiResponseError as ApiError, ApiResponseError } from '@skillswap/contracts';

export async function authenticate(
  mode: 'login' | 'register',
  payload: {
    email: string;
    password: string;
    displayName?: string;
    role?: 'user';
  },
  remember = false,
): Promise<{ tokens: TokenPair }> {
  const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const bodyPayload = mode === 'register'
    ? {
        email: payload.email,
        password: payload.password,
        displayName: payload.displayName ?? payload.email.split('@')[0],
        role: payload.role ?? 'user',
      }
    : {
        email: payload.email,
        password: payload.password,
      };

  const res = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    const msg =
      errorBody?.message ||
      errorBody?.errors?.[0]?.message ||
      (mode === 'register' ? 'Đăng ký thất bại' : 'Đăng nhập thất bại');
    throw new Error(msg);
  }

  const data = await unwrapEnvelope<{ accessToken: string; refreshToken: string }>(res);
  saveTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken }, remember);

  // Immediately try to fetch user info from /auth/me or store payload
  try {
    const meRes = await fetch(`${API}/api/auth/me`, {
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${data.accessToken}`,
      },
    });
    if (meRes.ok) {
      const meData = await unwrapEnvelope<{
        id?: string;
        email: string;
        displayName?: string;
        role?: string;
        studentVerification?: { status?: string } | null;
      }>(meRes);
      saveStoredUser({
        id: meData.id,
        email: meData.email,
        displayName: meData.displayName || payload.displayName || payload.email.split('@')[0],
        role: meData.role,
        studentVerificationStatus: meData.studentVerification?.status,
      }, remember);
    } else {
      saveStoredUser({
        email: payload.email,
        displayName: payload.displayName || payload.email.split('@')[0],
        role: 'user',
      }, remember);
    }
  } catch {
    saveStoredUser({
      email: payload.email,
      displayName: payload.displayName || payload.email.split('@')[0],
      role: 'user',
    }, remember);
  }

  return {
    tokens: { accessToken: data.accessToken, refreshToken: data.refreshToken },
  };
}

export async function logout(): Promise<void> {
  const session = getTokens();
  if (session?.refreshToken) {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } catch {
      // Ignore network errors on logout
    }
  }
  clearSession();
}

export async function getMe(): Promise<UserProfile | null> {
  const res = await callApi('/auth/me');
  if (!res.ok) return null;
  return unwrapEnvelope<UserProfile>(res);
}

export const WALLET_BALANCE_STORAGE_KEY = 'skillswap-wallet-balance-override';
export const WALLET_BALANCE_EVENT = 'skillswap:balance-updated';

/**
 * Wallet balance is server-owned state and is never cached in `localStorage`.
 *
 * An earlier revision persisted an optimistic balance here and let it override
 * the server (`override ?? serverBal`). Because the key never expired and was
 * never reconciled, a reload or a different sign-in could show a balance that
 * disagreed with the ledger. The key is deleted on read so sessions that still
 * carry it self-heal.
 */
export function getStoredWalletBalance(): WalletBalanceView | null {
  if (typeof window === 'undefined') return null;
  try {
    // Purge values written by the previous caching revision.
    window.localStorage.removeItem(WALLET_BALANCE_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode); nothing to purge.
  }
  return null;
}

/**
 * Broadcasts a fresh balance to listeners on the current page (e.g. the navbar
 * badge) without persisting it. The value always originates from a server
 * response, so the UI updates instantly while staying server-truthful.
 */
export function dispatchWalletBalanceUpdate(balance: WalletBalanceView): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WALLET_BALANCE_EVENT, { detail: balance }));
  }
}

