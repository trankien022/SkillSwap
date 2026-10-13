import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * The one place the app is allowed to touch a platform-backed key-value store.
 *
 * `expo-secure-store` is a NATIVE module (Android Keystore / iOS Keychain). Its
 * web build is a stub whose module object is `{}`, so ANY direct call to
 * `SecureStore.getItemAsync` / `setItemAsync` / `deleteItemAsync` rejects on
 * Expo Web with:
 *
 *   ExpoSecureStore.default.getValueWithKeyAsync is not a function
 *
 * That is not a bug in SecureStore — a browser has no Keystore. The mistake is
 * calling a native-only module from shared code. So this module is the only
 * importer of `expo-secure-store` in the app, and every consumer goes through
 * `defaultKeyValueStore()` instead, which selects a backend by platform.
 *
 * Do not add another `import * as SecureStore from 'expo-secure-store'` at a
 * call site; extend this module instead.
 */
export interface KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/**
 * Web backend. Storing nothing durably is the correct behaviour, not a
 * workaround: SecureStore wraps hardware-backed keystores, and `localStorage`
 * is readable by any script on the origin, so persisting tokens there would
 * trade a crash for a token leak.
 *
 * The consequence is explicit and intended: on web, values live until the tab
 * reloads, and a reload returns the user to the signed-out state.
 */
export class InMemoryKeyValueStore implements KeyValueStore {
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

/**
 * Native backend: the real SecureStore, untouched.
 *
 * `SecureStore` satisfies `KeyValueStore` structurally.
 */
export const secureStoreKeyValueStore: KeyValueStore = {
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
};

/**
 * A single shared instance per platform.
 *
 * The in-memory backend is stateful, so it must be a module-level singleton:
 * creating one per call would give each consumer a private map and silently
 * break cross-module reads (e.g. the push opt-in written by the notifications
 * screen and read by the root layout).
 */
let shared: KeyValueStore | null = null;

/** The store for the current platform. Cached so all consumers share state. */
export function defaultKeyValueStore(): KeyValueStore {
  if (shared === null) {
    shared = Platform.OS === 'web' ? new InMemoryKeyValueStore() : secureStoreKeyValueStore;
  }
  return shared;
}
