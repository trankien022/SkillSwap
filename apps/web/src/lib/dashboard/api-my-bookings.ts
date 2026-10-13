import type { LearnerBookingItemView } from '@skillswap/contracts';
import type { LearnerBookingView, BookingState } from './types';

/**
 * Maps a backend `LearnerBookingItemView` (Route 22, `GET /classes/bookings/me`)
 * into the dashboard's presentation model.
 *
 * This is the single place that shape conversion lives; the live dashboard
 * gateway (`http-gateway.ts`) and any adapter built on top of it both use it so
 * the two can never drift.
 *
 * The dashboard does not keep its own copy of these bookings in `localStorage`:
 * a booking created in the checkout flow is already persisted server-side, so it
 * appears on the next read. Caching it client-side only risked showing entries
 * the ledger had rejected.
 */
export function mapContractBookingToView(item: LearnerBookingItemView): LearnerBookingView {
  const teacherName = item.classSummary.teacherDisplayName;
  return {
    id: item.bookingId,
    classId: item.classId,
    classTitle: item.classSummary.description,
    skillIcon: 'code',
    teacherName,
    teacherInitial: teacherName.charAt(0).toUpperCase() || 'T',
    teacherSchoolLabel: 'Peer student',
    startsAt: item.classSummary.startsAt,
    durationMinutes: item.classSummary.durationMinutes,
    priceCredits: item.priceCredits,
    state: toPresentationState(item),
    // derived: the backend exposes the escrow deadline, not a live countdown.
    autoReleaseCountdownSeconds:
      item.state === 'completed' && item.expiresAt !== null
        ? secondsUntil(item.expiresAt)
        : undefined,
    roomCode: item.roomAccessEligible ? `ROOM-${item.bookingId.slice(0, 8)}` : undefined,
    // Review bodies and star counts are per-class (`GET /classes/:id`), which the
    // dashboard does not fetch, so the review block is intentionally omitted
    // rather than rendered with a fabricated "0 / 5".
    // derived: receipts are numbered from the booking id until a receipt route exists.
    receiptId: item.state === 'completed' ? `REC-${item.bookingId.slice(0, 8)}` : undefined,
  };
}

/**
 * Collapses the four-value backend booking state into the richer presentation
 * state. A `confirmed` booking whose class has already ended is what the learner
 * must act on, so it surfaces as `pending_learner_confirmation`.
 */
export function toPresentationState(item: LearnerBookingItemView): BookingState {
  switch (item.state) {
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'disputed':
      return 'no_show_reported';
    case 'confirmed':
    default: {
      const startsAt = new Date(item.classSummary.startsAt);
      const endsAt = new Date(startsAt.getTime() + item.classSummary.durationMinutes * 60_000);
      const now = Date.now();
      if (now < startsAt.getTime()) return 'upcoming';
      if (now <= endsAt.getTime()) return 'in_progress';
      return 'pending_learner_confirmation';
    }
  }
}

function secondsUntil(iso: string | null): number | undefined {
  if (iso === null) return undefined;
  const diff = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  return diff > 0 ? diff : undefined;
}
