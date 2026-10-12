import type { ActiveSession } from './session-types';

export const SESSION_STORE = Symbol('SESSION_STORE');

/**
 * Port for persisting native session tokens and user state securely on-device.
 */
export interface SessionStorePort {
  save(session: ActiveSession): Promise<void>;
  load(): Promise<ActiveSession | null>;
  clear(): Promise<void>;
}
