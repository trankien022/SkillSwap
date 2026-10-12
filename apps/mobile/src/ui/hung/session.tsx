import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { MeResponse } from '@skillswap/contracts';
import { authClient } from '@/infrastructure/auth/native-client';

const Context = createContext<{
  user: MeResponse | null;
  ready: boolean;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
} | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [ready, setReady] = useState(false);
  async function reload() {
    setUser(await authClient.me());
  }
  async function signOut() {
    try {
      await authClient.logout();
    } finally {
      setUser(null);
    }
  }
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await authClient.restore();
        if (authClient.hasSession()) {
          const me = await authClient.me();
          if (alive) setUser(me);
        }
      } catch {
        /* Explore remains usable when the backend is offline. */
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return <Context.Provider value={{ user, ready, reload, signOut }}>{children}</Context.Provider>;
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('Missing SessionProvider');
  return value;
}
