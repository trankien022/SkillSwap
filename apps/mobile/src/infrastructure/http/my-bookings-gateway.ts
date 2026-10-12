import {
  myBookingsPageSchema,
  type BookingState,
  type MyBookingsPageView,
} from '@skillswap/contracts';
import type { GatewayClient } from './gateway-client';

export type { BookingState, MyBookingsPageView };

export interface MyBookingsQueryOptions {
  readonly state?: BookingState;
  readonly upcoming?: boolean;
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Gateway adapter for fetching learner bookings history and upcoming schedule (Route 22).
 *
 * Implements:
 * - Route 22: GET /api/classes/bookings/me with URLSearchParams query filters and keyset cursor pagination.
 * - Options: typed state, upcoming (boolean), limit (1..50, server default 20), and keyset cursor.
 * - Serializes upcoming: false explicitly as 'false', true as 'true', omitted when undefined.
 * - Properly trims and encodes keyset cursor.
 * - Strictly excludes learnerId/owner override query parameters (server strictly derives identity from bearer token).
 * - Relies on GatewayClient.authenticatedRequest as the sole HTTP GET retry owner (401 token refresh).
 * - Validates backend response against myBookingsPageSchema:
 *     - Preserves exact totalUpcomingCount returned by server (never derived from page items count).
 *     - Preserves roomAccessEligible, ratingEligible, and hasRated eligibility flags.
 */
export class MyBookingsGateway {
  constructor(private readonly gateway: GatewayClient) {}

  async getMyBookingsPage(options?: MyBookingsQueryOptions): Promise<MyBookingsPageView> {
    const params = new URLSearchParams();

    if (options?.state !== undefined) {
      params.set('state', options.state);
    }

    if (options?.upcoming !== undefined) {
      params.set('upcoming', options.upcoming ? 'true' : 'false');
    }

    if (options?.limit !== undefined && options.limit > 0) {
      params.set('limit', String(options.limit));
    }

    if (options?.cursor !== undefined && options.cursor.trim().length > 0) {
      params.set('cursor', options.cursor.trim());
    }

    const queryString = params.toString();
    const path = `/classes/bookings/me${queryString ? `?${queryString}` : ''}`;

    const raw = await this.gateway.authenticatedRequest<unknown>(path, {
      method: 'GET',
    });

    return myBookingsPageSchema.parse(raw);
  }

}
