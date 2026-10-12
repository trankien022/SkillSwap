import * as SecureStore from 'expo-secure-store';
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
 */
export class SecureSessionStore implements SessionStorePort {
  constructor(
    private readonly backend: SecureStoreBackend = SecureStore,
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
