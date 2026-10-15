/**
 * FR-011 (ADR-020): request access to a booking's Jitsi room.
 *
 * `callApi` returns the `Response` **without throwing on 4xx/5xx** (see
 * `api-client.ts`) — it only throws when a token refresh itself fails. The old
 * live-classroom code did `if (res.ok) { … }` and therefore silently discarded
 * every denial: a learner whose window was not open still saw a "live" room.
 *
 * This helper goes through `unwrapEnvelope`, which raises `ApiResponseError`
 * carrying the stable server `code`. The caller branches on that code — never on
 * the human-readable message (contracts/envelope.ts is explicit about this).
 */

import type { RoomAccessResponse } from '@skillswap/contracts';
import { roomAccessResponseSchema } from '@skillswap/contracts';
import { ApiResponseError, callApi, unwrapEnvelope } from '../api-client';

/** The server `code` values room-access can fail with (domain-error.filter.ts). */
export type RoomAccessFailureCode =
  | 'RoomAccessDeniedError'
  | 'BookingNotFoundError'
  | 'RoomUnavailableError'
  | 'HTTP_403'
  | 'HTTP_404'
  | 'HTTP_503'
  | 'INTERNAL_ERROR';

export class RoomAccessError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'RoomAccessError';
  }
}

export interface RequestRoomAccessResult {
  room: string;
  token: string;
  expiresAt: string;
  url: string;
}

/**
 * Asks the API for a room token. Resolves with the validated payload on success
 * and throws `RoomAccessError` with the server `code` otherwise.
 */
export async function requestRoomAccess(
  bookingId: string,
  displayName: string,
): Promise<RequestRoomAccessResult> {
  const res = await callApi(`/classes/bookings/${encodeURIComponent(bookingId)}/room-access`, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });

  try {
    const data = await unwrapEnvelope<RoomAccessResponse>(res);
    return roomAccessResponseSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiResponseError) {
      throw new RoomAccessError(error.code, res.status, error.message);
    }
    throw error;
  }
}

/**
 * Maps a failure code onto the reason the UI should explain. Unknown codes fall
 * back to `unavailable` so nothing is ever silently "fine".
 */
export type RoomAccessReason =
  | 'not_a_party'
  | 'not_confirmed'
  | 'window_not_open'
  | 'window_closed'
  | 'not_found'
  | 'provider_unavailable'
  | 'unavailable';

/**
 * Exact server messages from `room-access.ts` (`deny(...)` calls). Matching the
 * full string — not a substring — keeps this honest: if the domain wording ever
 * changes, the test below fails loudly instead of silently mis-classifying.
 *
 * The envelope only carries the error class name (`RoomAccessDeniedError`) as
 * `code`; the `reason` enum stays server-side. Surfacing it on the wire would be
 * a contracts change, so we mirror the documented messages here.
 */
const DENIAL_MESSAGES: Record<string, RoomAccessReason> = {
  'Requester is not a party to this booking': 'not_a_party',
  'Room access opens shortly before the class starts': 'window_not_open',
  'Room access has closed for this class': 'window_closed',
};

export function reasonForFailure(code: string, message: string): RoomAccessReason {
  if (code === 'BookingNotFoundError' || code === 'HTTP_404') return 'not_found';
  if (code === 'RoomUnavailableError' || code === 'HTTP_503') return 'provider_unavailable';
  if (code === 'RoomAccessDeniedError' || code === 'HTTP_403') {
    if (message in DENIAL_MESSAGES) return DENIAL_MESSAGES[message];
    // `Booking is ${state}, not joinable` — the state is interpolated.
    if (/^Booking is .*, not joinable$/.test(message)) return 'not_confirmed';
  }
  return 'unavailable';
}
