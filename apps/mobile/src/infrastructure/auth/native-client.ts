import { defaultKeyValueStore } from '@/infrastructure/storage/key-value-store';
import { AuthClient, type SessionStorage } from './client';

const key = 'skillswap-hung-session';
// The platform-aware store already keeps tokens in memory on web and in
// SecureStore on native, so no per-platform branch is needed here.
const storage: SessionStorage = {
  read: () => defaultKeyValueStore().getItemAsync(key),
  write: (value) => defaultKeyValueStore().setItemAsync(key, value),
  remove: () => defaultKeyValueStore().deleteItemAsync(key),
};
export const authClient = new AuthClient(
  process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000',
  storage,
);
