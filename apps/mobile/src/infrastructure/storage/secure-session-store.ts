import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { SessionStorePort } from '@/application/port/session-store';
import {
  CorruptSessionError,
  type ActiveSession,
  type SessionTokens,
} from '@/application/port/session-types';

export const DEFAULT_SESSION_STORAGE_KEY = 'skillswap.mobile.session';

export interface SecureStoreBackend {
  getItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
}

/**
 * Backend for Expo Web, where `expo-secure-store` has no implementation: its web
 * shim is `export default {}`, so any call rejects with
 * "ExpoSecureStore.getValueWithKeyAsync is not a function".
 *
 * Storing nothing is not a workaround — it is the correct behaviour. SecureStore
 * wraps Android Keystore / iOS Keychain; a browser has no equivalent, and
 * `localStorage` is readable by any script on the origin, so writing tokens there
 * would trade a boot error for a token leak.
 *
 * The consequence is explicit: a session lasts until the tab reloads, and a
 * reload returns the user to the login screen. `native-client.ts` already made
 * exactly this choice for the auth client, so the two now agree.
 */
export class InMemorySessionBackend implements SecureStoreBackend {
  private readonly entries = new Map<string, string>();

  async getItemAsync(key: string): Promise<string | null> {
    return this.entries.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    this.entries.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

export class SecureStoreError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = 'SecureStoreError';
  }
}

/**
 * Native SecureStore adapter for persisting tokens and active session.
 *
 * Implements SessionStorePort with:
 * - Structural corruption detection (evicts invalid JSON/schema and throws CorruptSessionError).
 * - Direct visibility into hardware/keychain failures (surfaces SecureStoreError).
 * - Injectable backend for testing without native mobile bindings.
 *
 * On web the default backend is in-memory, because `expo-secure-store` is a
 * native module with no browser implementation. Before this, boot on Expo Web
 * always failed and showed the "LỖI KẾT NỐI" screen: `load()` called the missing
 * native method, the TypeError was wrapped as a SecureStoreError, and
 * `restoreSession` correctly refuses to treat a non-401 failure as a signed-out
 * user. The screen was honest — it was the storage layer that could not work.
 */
export class SecureSessionStore implements SessionStorePort {
  constructor(
    private readonly backend: SecureStoreBackend = defaultBackend(),
    private readonly storageKey: string = DEFAULT_SESSION_STORAGE_KEY,
  ) {}

  async save(session: ActiveSession): Promise<void> {
    try {
      const payload = JSON.stringify(session);
      await this.backend.setItemAsync(this.storageKey, payload);
    } catch (error) {
      throw new SecureStoreError('Failed to write session to secure storage', error);
    }
  }

  async load(): Promise<ActiveSession | null> {
    let raw: string | null;
    try {
      raw = await this.backend.getItemAsync(this.storageKey);
    } catch (error) {
      throw new SecureStoreError('Failed to read session from secure storage', error);
    }

    if (raw === null || raw.trim() === '') {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (jsonErr) {
      await this.evictCorruptState();
      throw new CorruptSessionError('Stored session payload is not valid JSON', jsonErr);
    }

    if (!this.isValidSessionShape(parsed)) {
      await this.evictCorruptState();
      throw new CorruptSessionError('Stored session payload is missing required token attributes');
    }

    return parsed;
  }

  async clear(): Promise<void> {
    try {
      await this.backend.deleteItemAsync(this.storageKey);
    } catch (error) {
      throw new SecureStoreError('Failed to delete session from secure storage', error);
    }
  }

  private async evictCorruptState(): Promise<void> {
    try {
      await this.backend.deleteItemAsync(this.storageKey);
    } catch (error) {
      throw new SecureStoreError('Failed to evict corrupt session from secure storage', error);
    }
  }

  private isValidSessionShape(data: unknown): data is ActiveSession {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const candidate = data as { tokens?: Partial<SessionTokens> };
    if (!candidate.tokens || typeof candidate.tokens !== 'object') {
      return false;
    }

    const { accessToken, refreshToken, expiresAt, tokenType } = candidate.tokens;

    return (
      typeof accessToken === 'string' &&
      accessToken.length > 0 &&
      typeof refreshToken === 'string' &&
      refreshToken.length > 0 &&
      typeof expiresAt === 'number' &&
      !Number.isNaN(expiresAt) &&
      tokenType === 'Bearer'
    );
  }
}

/**
 * The backend to use when the caller does not inject one.
 *
 * Web gets the in-memory implementation; every other platform gets SecureStore.
 * `SecureStore` satisfies `SecureStoreBackend` structurally, but its functions
 * are platform-shimmed, so the platform must be checked here rather than the
 * choice being left to the call site.
 */
function defaultBackend(): SecureStoreBackend {
  if (Platform.OS === 'web') {
    return new InMemorySessionBackend();
  }
  return SecureStore;
}
