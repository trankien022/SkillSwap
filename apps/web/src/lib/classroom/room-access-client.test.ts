import { describe, expect, it } from 'vitest';
import { reasonForFailure } from './room-access-client';

/**
 * The mapping mirrors the `deny(...)` messages in
 * `apps/api/src/modules/live-class/internal/domain/room-access.ts`. These cases
 * are the literal strings that file throws, so a wording change breaks this test
 * instead of silently degrading the UI to "unavailable".
 */
describe('reasonForFailure', () => {
  it('maps the real domain denial messages', () => {
    expect(
      reasonForFailure('RoomAccessDeniedError', 'Requester is not a party to this booking'),
    ).toBe('not_a_party');
    expect(
      reasonForFailure('RoomAccessDeniedError', 'Room access opens shortly before the class starts'),
    ).toBe('window_not_open');
    expect(
      reasonForFailure('RoomAccessDeniedError', 'Room access has closed for this class'),
    ).toBe('window_closed');
    expect(reasonForFailure('RoomAccessDeniedError', 'Booking is pending, not joinable')).toBe(
      'not_confirmed',
    );
    expect(
      reasonForFailure('RoomAccessDeniedError', 'Booking is cancelled, not joinable'),
    ).toBe('not_confirmed');
  });

  it('maps transport-level failures by code', () => {
    expect(reasonForFailure('BookingNotFoundError', 'Booking not found: x')).toBe('not_found');
    expect(reasonForFailure('HTTP_404', 'Not Found')).toBe('not_found');
    expect(reasonForFailure('RoomUnavailableError', 'Room provider unavailable')).toBe(
      'provider_unavailable',
    );
    expect(reasonForFailure('HTTP_503', 'Service Unavailable')).toBe('provider_unavailable');
  });

  it('never reports success for an unrecognised failure', () => {
    expect(reasonForFailure('INTERNAL_ERROR', 'Internal server error')).toBe('unavailable');
    expect(reasonForFailure('RoomAccessDeniedError', 'some new wording')).toBe('unavailable');
  });
});
