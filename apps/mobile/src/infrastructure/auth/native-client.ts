import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { AuthClient, type SessionStorage } from './client';

const key = 'skillswap-hung-session';
// Browser preview keeps tokens in memory only; native persistence uses SecureStore.
const storage: SessionStorage =
  Platform.OS === 'web'
    ? {
        read: async () => null,
        write: async () => {},
        remove: async () => {},
      }
    : {
        read: () => SecureStore.getItemAsync(key),
        write: (value) => SecureStore.setItemAsync(key, value),
        remove: () => SecureStore.deleteItemAsync(key),
      };
export const authClient = new AuthClient(
  process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000',
  storage,
);
