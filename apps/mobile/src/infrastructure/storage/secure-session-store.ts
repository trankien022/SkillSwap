import type { SessionStorePort } from '@/application/port/session-store';
import {
  CorruptSessionError,
  type ActiveSession,
  type SessionTokens,
} from '@/application/port/session-types';
import {
  defaultKeyValueStore,
  InMemoryKeyValueStore,
  type KeyValueStore,
} from './key-value-store';

export const DEFAULT_SESSION_STORAGE_KEY = 'skillswap.mobile.session';

/**
 * @deprecated Use `KeyValueStore` from `./key-value-store`. Kept as an alias so
 * existing specs and call sites keep compiling while the platform switch lives
 * in exactly one module.
 */
export type SecureStoreBackend = KeyValueStore;

/**
 * @deprecated Use `InMemoryKeyValueStore` from `./key-value-store`.
 */
export class InMemorySessionBackend extends InMemoryKeyValueStore {}

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
 * On web the default backend is in-memory, chosen by `defaultKeyValueStore()`
 * in `./key-value-store` — the single place the platform switch lives. Before
 * that, boot on Expo Web always failed and showed the "LỖI KẾT NỐI" screen:
 * `load()` called a missing native method, the TypeError was wrapped as a
 * SecureStoreError, and `restoreSession` correctly refuses to treat a non-401
 * failure as a signed-out user. The screen was honest — it was the storage
 * layer that could not work.
 */
export class SecureSessionStore implements SessionStorePort {
  constructor(
    private readonly backend: KeyValueStore = defaultKeyValueStore(),
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

