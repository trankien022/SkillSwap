import { describe, expect, it } from 'vitest';
import { confirmSaysSettled, resolveSettlement } from './settlement';
import type { ConfirmBookingResponse, OwnBookingSummaryView } from './domain';

/**
 * Spec parity with `apps/mobile/src/ui/class-detail-coordinator.spec.ts`
 * (`never fabricates success when confirm returns confirmed: false…` and the
 * `confirmed: true` success case), because both clients must believe the same
 * thing: a booking is only settled when the hold reads `confirmed`.
 */
const booking = (state: string) => ({
  bookingId: 'bkg-1',
  classId: 'class-1',
  learnerId: 'learner-1',
  state,
  priceCredits: 40,
  createdAt: '2026-10-15T09:00:00.000Z',
});

const hold = (state: OwnBookingSummaryView['state']): OwnBookingSummaryView => ({
  bookingId: 'bkg-1',
  state,
  expiresAt: '2026-10-30T10:15:00.000Z',
});

const rejectedReply: ConfirmBookingResponse = { confirmed: false, booking: null };
const acceptedReply: ConfirmBookingResponse = { confirmed: true, booking: booking('confirmed') };

describe('resolveSettlement', () => {
  it('never fabricates success when confirm returns confirmed: false and null booking', () => {
    // The coordinator's reconcile case: hold still pending after a negative
    // reply → keep checking, and a hold that reads back as absent is a no.
    expect(resolveSettlement(rejectedReply, { read: 'ok', ownBooking: hold('pending') })).toBe('settling');
    expect(resolveSettlement(rejectedReply, { read: 'ok', ownBooking: null })).toBe('unconfirmed');
    expect(resolveSettlement(rejectedReply, { read: 'ok', ownBooking: hold('cancelled') })).toBe(
      'unconfirmed',
    );
  });

  it('settles only when the read-back says confirmed', () => {
    expect(resolveSettlement(acceptedReply, { read: 'ok', ownBooking: hold('confirmed') })).toBe(
      'settled',
    );
    // A positive reply the read-back does not confirm is progress, not a win:
    // the reply may only lift the outcome to "still settling" — success is
    // never granted by the reply alone, whatever it claims.
    expect(resolveSettlement(acceptedReply, { read: 'ok', ownBooking: hold('pending') })).toBe(
      'settling',
    );
    expect(resolveSettlement(acceptedReply, { read: 'ok', ownBooking: null })).toBe('settling');
  });

  it('settles from the read-back alone, whatever the reply was', () => {
    // Mobile reconciles a `confirmed: false` reply with a GET and succeeds when
    // that GET shows the hold confirmed.
    expect(resolveSettlement(rejectedReply, { read: 'ok', ownBooking: hold('confirmed') })).toBe(
      'settled',
    );
    expect(resolveSettlement(null, { read: 'ok', ownBooking: hold('confirmed') })).toBe('settled');
  });

  it('reports an unreadable read-back as unknown, never as success or failure', () => {
    expect(resolveSettlement(rejectedReply, { read: 'failed' })).toBe('unknown');
    expect(resolveSettlement(acceptedReply, { read: 'failed' })).toBe('unknown');
    expect(resolveSettlement(null, { read: 'failed' })).toBe('unknown');
  });

  it('keeps polling while a hold is pending, even when the confirm call failed', () => {
    expect(resolveSettlement(null, { read: 'ok', ownBooking: hold('pending') })).toBe('settling');
  });
});

describe('confirmSaysSettled', () => {
  it('requires both the flag and a confirmed booking in the reply', () => {
    expect(confirmSaysSettled(acceptedReply)).toBe(true);
    expect(confirmSaysSettled({ confirmed: true, booking: booking('pending') })).toBe(false);
    expect(confirmSaysSettled(rejectedReply)).toBe(false);
  });
});
