import type { ConfirmBookingResponse, OwnBookingSummaryView } from './domain';

/**
 * Settlement decisions for a booking confirm (FR-007 / AC-018).
 *
 * This is the web port of the decision `apps/mobile/src/ui/class-detail-coordinator.ts`
 * makes after `POST /classes/bookings/:id/confirm`, and it exists for the same
 * reason: the confirm endpoint answers HTTP 200 with `confirmed: false` by
 * design while the debit is still settling (`confirm-booking.ts`), so the reply
 * on its own can never be shown as success. The read-back of the caller's own
 * hold is the only thing that earns it.
 *
 * Pure on purpose — no timers, no fetching — so the four outcomes can be tested
 * against exactly the inputs the coordinator reconciles.
 */

/** The four honest outcomes of one confirm + read-back. */
export type SettlementStatus =
  /** The hold reads `confirmed`: money moved, seat is the learner's. */
  | 'settled'
  /** Still `pending`, or the server committed but the read has not caught up. */
  | 'settling'
  /** The read answered and the hold is not pending and not confirmed: no. */
  | 'unconfirmed'
  /** The read could not be made: unknown is not success and not failure. */
  | 'unknown';

/**
 * What the read-back produced. `read: 'failed'` is kept apart from
 * `ownBooking: null` (a successful read showing no hold) because the two must
 * not collapse into one state: "you have no seat" and "I could not check" are
 * different answers.
 */
export type SettlementReadback =
  | { read: 'ok'; ownBooking: OwnBookingSummaryView | null }
  | { read: 'failed' };

/**
 * Does the confirm reply claim completion? `confirmed` must be true **and** the
 * booking it returns must read `confirmed` — either alone is insufficient.
 *
 * Even a fully positive reply is not shown as success: it only lifts the
 * outcome to `settling` until the read-back agrees.
 */
export function confirmSaysSettled(response: ConfirmBookingResponse): boolean {
  return response.confirmed === true && response.booking?.state === 'confirmed';
}

/**
 * Resolve one confirm attempt into what the UI may say.
 *
 * @param response the confirm reply, or null when the call itself failed —
 *   a failed call settles nothing but does not stop the read from deciding.
 * @param readback the hold as read back after the confirm.
 */
export function resolveSettlement(
  response: ConfirmBookingResponse | null,
  readback: SettlementReadback,
): SettlementStatus {
  // The read is the source of truth: a hold that reads `confirmed` is settled
  // whatever the reply said, including `confirmed: false` while settling.
  if (readback.read === 'ok' && readback.ownBooking?.state === 'confirmed') {
    return 'settled';
  }

  // Nothing to judge by. Never reported as success (coordinator: catch →
  // `settlement_unknown`), never as failure either.
  if (readback.read === 'failed') {
    return 'unknown';
  }

  // The server committed but the read still shows the old state: keep
  // checking rather than claiming either outcome.
  if (response !== null && confirmSaysSettled(response)) {
    return 'settling';
  }

  // Hold still pending → the debit may yet land (coordinator polls here).
  if (readback.ownBooking?.state === 'pending') {
    return 'settling';
  }

  // The read answered and there is no live hold: no seat was bought.
  return 'unconfirmed';
}
