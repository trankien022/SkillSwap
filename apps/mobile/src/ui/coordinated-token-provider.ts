import type { ActiveSession } from '@/application/port/session-types';
import type { SessionTokenProvider } from '@/infrastructure/http/gateway-client';

export type AuthoritativeSessionService = {
  getAccessToken(): Promise<string>;
  refreshSession(): Promise<ActiveSession>;
  getActiveSession(): ActiveSession | null;
};

export interface CoordinatedTokenProviderOptions {
  readonly getUiGeneration: () => number;
  readonly isMounted: () => boolean;
  readonly onSessionSync: (session: ActiveSession | null) => void;
}

/**
 * Creates a coordinated SessionTokenProvider that synchronizes the authoritative
 * SessionService state with React/UI session listeners.
 *
 * Invariants:
 * - GatewayClient.authenticatedRequest remains the single HTTP retry owner.
 * - Both getAccessToken and refreshSession synchronize authoritative service.getActiveSession()
 *   in a finally block with captured UI generation and mounted checks.
 * - getAccessToken internally refreshes/invalidates expired sessions before Gateway explicit retry.
 * - Temporary network errors preserve service session state and propagate the preserved session.
 * - Fenced by generation and mounted status so obsolete results from superseded requests,
 *   logouts, or unmounted views never overwrite current UI state.
 */
export function createCoordinatedTokenProvider(
  service: AuthoritativeSessionService,
  options: CoordinatedTokenProviderOptions,
): SessionTokenProvider {
  return {
    async getAccessToken(): Promise<string> {
      const capturedGen = options.getUiGeneration();
      try {
        return await service.getAccessToken();
      } finally {
        if (options.isMounted() && options.getUiGeneration() === capturedGen) {
          options.onSessionSync(service.getActiveSession());
        }
      }
    },

    async refreshSession(): Promise<ActiveSession> {
      const capturedGen = options.getUiGeneration();
      try {
        const refreshed = await service.refreshSession();
        return refreshed;
      } finally {
        if (options.isMounted() && options.getUiGeneration() === capturedGen) {
          options.onSessionSync(service.getActiveSession());
        }
      }
    },
  };
}
