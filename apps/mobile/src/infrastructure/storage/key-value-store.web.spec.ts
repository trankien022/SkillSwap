/**
 * Regression: no web code path may reach `expo-secure-store`.
 *
 * The reported failure was
 *   ExpoSecureStore.default.getValueWithKeyAsync is not a function
 * thrown from `getItemAsync` when the user pressed sign out on Expo Web.
 *
 * The reason it reached production is the shape of the OTHER tests' mock. They
 * stub `expo-secure-store` as an object with *working* `getItemAsync` /
 * `setItemAsync` / `deleteItemAsync`, so they pass whether or not the call site
 * is web-safe. That mock describes a device, not a browser.
 *
 * Here the mock is the real web shim: the module's value is `{}`. Any code that
 * touches it throws the same TypeError the browser does. That makes this spec
 * fail against pre-change code and pass only when the platform adapter is used —
 * the same discipline as `http/fetch-receiver-binding.spec.ts`.
 */

// The genuine Expo Web build of expo-secure-store: an empty object. `default` is
// present because Metro/Babel expose the module namespace with a `default` key,
// which is exactly why the real error mentions `.default.getValueWithKeyAsync`.
jest.mock('expo-secure-store', () => ({ __esModule: true, default: {} }));

// `react-native` ships untranspiled Flow. Only `Platform.OS` is needed, and
// pinning it to 'web' is the point of this file.
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

import {
  defaultKeyValueStore,
  InMemoryKeyValueStore,
} from './key-value-store';
import {
  DEFAULT_SESSION_STORAGE_KEY,
  SecureSessionStore,
} from './secure-session-store';

// A representative non-session key. Declared as a literal rather than imported
// from `notification-device-lifecycle`, because that module pulls in
// `expo-notifications`, which a node-environment jest cannot transform.
const PUSH_DEVICE_ID_KEY = 'skillswap.notification.device-id';

describe('expo-secure-store on Expo Web', () => {
  it('the mocked native module really is unusable, as the browser sees it', async () => {
    // Guards the guard: if this ever stops throwing, the mock no longer models
    // the browser and every assertion below would silently become vacuous.
    const SecureStore = await import('expo-secure-store');
    const native = (SecureStore as unknown as { default: Record<string, unknown> }).default;
    const call = () =>
      (native.getItemAsync as (k: string) => Promise<string | null>)(PUSH_DEVICE_ID_KEY);

    expect(() => call()).toThrow(/is not a function/);
  });

  it('resolves the shared store to the in-memory backend', () => {
    expect(defaultKeyValueStore()).toBeInstanceOf(InMemoryKeyValueStore);
  });

  it('returns a stable instance so modules share one map', () => {
    // A fresh backend per call would give each consumer a private map: the push
    // opt-in written by the notifications screen would be invisible to the root
    // layout, and the locale would never round-trip.
    expect(defaultKeyValueStore()).toBe(defaultKeyValueStore());
  });

  it('round-trips a value through the store the app actually uses', async () => {
    const store = defaultKeyValueStore();
    await store.setItemAsync(PUSH_DEVICE_ID_KEY, 'device-42');
    expect(await store.getItemAsync(PUSH_DEVICE_ID_KEY)).toBe('device-42');
    await store.deleteItemAsync(PUSH_DEVICE_ID_KEY);
    expect(await store.getItemAsync(PUSH_DEVICE_ID_KEY)).toBeNull();
  });

  it('persists a session without throwing for the missing native method', async () => {
    const store = new SecureSessionStore(new InMemoryKeyValueStore());
    const session = {
      tokens: {
        accessToken: 'access-123',
        refreshToken: 'refresh-abc',
        expiresAt: 1770000000000,
        tokenType: 'Bearer' as const,
      },
      user: {
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'Test User',
        role: 'user',
        status: 'active',
      },
    };

    await expect(store.save(session as never)).resolves.toBeUndefined();
    await expect(store.load()).resolves.toMatchObject({ user: { id: 'user-1' } });
    await expect(store.clear()).resolves.toBeUndefined();
  });

  it('evicts corrupt state via the in-memory backend, not the native one', async () => {
    const backend = new InMemoryKeyValueStore();
    await backend.setItemAsync(DEFAULT_SESSION_STORAGE_KEY, '{not json');
    const store = new SecureSessionStore(backend);

    await expect(store.load()).rejects.toThrow(/not valid JSON/);
    // Eviction must have gone through the same backend and left nothing behind.
    expect(await backend.getItemAsync(DEFAULT_SESSION_STORAGE_KEY)).toBeNull();
  });
});
