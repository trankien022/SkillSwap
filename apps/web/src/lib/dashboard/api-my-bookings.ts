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
    // Room code and receipt id are not fabricated here. The room is minted on
    // demand by `POST /classes/class/bookings/{bookingId}/room-access` (the live
    // page already calls it), and a receipt endpoint does not exist yet. The
    // dashboard renders an explicit "not yet available" state for both rather
    // than a synthetic value (FR-011 honesty, TASK-03 Phase 2).
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
