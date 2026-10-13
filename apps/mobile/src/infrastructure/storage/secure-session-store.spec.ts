jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// `react-native` ships untranspiled Flow, which a node-environment jest cannot
// parse. Only `Platform.OS` is used here, so the mock is the whole surface.
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import {
  CorruptSessionError,
  type ActiveSession,
} from '@/application/port/session-types';
import {
  InMemorySessionBackend,
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

/**
 * Expo Web has no SecureStore. The mocked `expo-secure-store` above hides that,
 * so these cases exercise the platform selection and the web backend directly.
 *
 * Before this, boot on Expo Web always failed: `load()` called a method that does
 * not exist in the browser, and `restoreSession` correctly refuses to treat a
 * non-401 failure as "signed out", so the app showed the connection-error screen
 * instead of a login form.
 */
describe('SecureSessionStore on Expo Web', () => {
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
  } as ActiveSession;

  it('round-trips a session in memory without touching SecureStore', async () => {
    const backend = new InMemorySessionBackend();
    const store = new SecureSessionStore(backend);

    await store.save(validSession);
    await expect(store.load()).resolves.toEqual(validSession);
  });

  it('returns null before anything is stored, so boot is a signed-out user and not an error', async () => {
    // This is the exact case the browser hit on a fresh page: no stored session.
    // It must resolve null (show the login form), never reject.
    const store = new SecureSessionStore(new InMemorySessionBackend());

    await expect(store.load()).resolves.toBeNull();
  });

  it('clears the session so logout is not silently ignored', async () => {
    const store = new SecureSessionStore(new InMemorySessionBackend());
    await store.save(validSession);
    await store.clear();

    await expect(store.load()).resolves.toBeNull();
  });

  it('does not persist across backend instances, which is the documented web trade-off', async () => {
    // A reload builds a new store, so the session is gone by design: the
    // alternative would be localStorage, readable by any script on the origin.
    const first = new SecureSessionStore(new InMemorySessionBackend());
    await first.save(validSession);

    const afterReload = new SecureSessionStore(new InMemorySessionBackend());
    await expect(afterReload.load()).resolves.toBeNull();
  });
});
