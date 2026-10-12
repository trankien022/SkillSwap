jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

import {
  CorruptSessionError,
  type ActiveSession,
} from '@/application/port/session-types';
import {
  SecureSessionStore,
  SecureStoreError,
  type SecureStoreBackend,
} from './secure-session-store';

class InMemorySecureStore implements SecureStoreBackend {
  private readonly storage = new Map<string, string>();
  public shouldFailSet = false;
  public shouldFailGet = false;
  public shouldFailDelete = false;

  async getItemAsync(key: string): Promise<string | null> {
    if (this.shouldFailGet) {
      throw new Error('OS Keychain read error');
    }
    return this.storage.get(key) ?? null;
  }

  async setItemAsync(key: string, value: string): Promise<void> {
    if (this.shouldFailSet) {
      throw new Error('OS Keychain write error');
    }
    this.storage.set(key, value);
  }

  async deleteItemAsync(key: string): Promise<void> {
    if (this.shouldFailDelete) {
      throw new Error('OS Keychain delete error');
    }
    this.storage.delete(key);
  }

  getRaw(key: string): string | undefined {
    return this.storage.get(key);
  }

  setRaw(key: string, value: string): void {
    this.storage.set(key, value);
  }
}

describe('SecureSessionStore', () => {
  let backend: InMemorySecureStore;
  let store: SecureSessionStore;

  const validSession: ActiveSession = {
    tokens: {
      accessToken: 'access-123',
      refreshToken: 'refresh-abc',
      expiresAt: 1770000000000,
      tokenType: 'Bearer',
    },
    user: {
      id: 'user-1',
      email: 'user@example.com',
      displayName: 'Test User',
      role: 'user',
      status: 'active',
    },
  };

  beforeEach(() => {
    backend = new InMemorySecureStore();
    store = new SecureSessionStore(backend);
  });

  it('persists and restores a valid session', async () => {
    await store.save(validSession);
    const restored = await store.load();

    expect(restored).toEqual(validSession);
  });

  it('returns null when storage is empty', async () => {
    const result = await store.load();
    expect(result).toBeNull();
  });

  it('clears persisted session', async () => {
    await store.save(validSession);
    await store.clear();

    const restored = await store.load();
    expect(restored).toBeNull();
  });

  it('detects corrupt JSON, evicts it from storage, and throws CorruptSessionError', async () => {
    backend.setRaw('skillswap.mobile.session', '{malformed-json');

    await expect(store.load()).rejects.toThrow(CorruptSessionError);
    // Verified that damaged payload is evicted
    expect(backend.getRaw('skillswap.mobile.session')).toBeUndefined();
  });

  it('detects missing or invalid session fields, evicts it, and throws CorruptSessionError', async () => {
    // Missing refreshToken and invalid expiresAt
    backend.setRaw(
      'skillswap.mobile.session',
      JSON.stringify({
        tokens: {
          accessToken: 'only-access',
          tokenType: 'Bearer',
        },
      }),
    );

    await expect(store.load()).rejects.toThrow(CorruptSessionError);
    expect(backend.getRaw('skillswap.mobile.session')).toBeUndefined();
  });

  it('surfaces OS SecureStore write failures as SecureStoreError', async () => {
    backend.shouldFailSet = true;

    await expect(store.save(validSession)).rejects.toThrow(SecureStoreError);
  });

  it('surfaces OS SecureStore read failures as SecureStoreError', async () => {
    backend.shouldFailGet = true;

    await expect(store.load()).rejects.toThrow(SecureStoreError);
  });

  it('surfaces eviction failure as SecureStoreError when deleting corrupt state fails', async () => {
    backend.setRaw('skillswap.mobile.session', '{malformed-json');
    backend.shouldFailDelete = true;

    await expect(store.load()).rejects.toThrow(SecureStoreError);
  });
});
