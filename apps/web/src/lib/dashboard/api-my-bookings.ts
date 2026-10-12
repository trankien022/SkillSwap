import { callApi, unwrapEnvelope } from '../api-client';
import type { MyBookingsPageView, LearnerBookingItemView } from '@skillswap/contracts';
import type { LearnerBookingView, BookingState } from './types';

/**
 * Maps a backend LearnerBookingItemView (Route 22) into the UI presentation model LearnerBookingView.
 */
export function mapContractBookingToView(item: LearnerBookingItemView): LearnerBookingView {
  let mappedState: BookingState = 'upcoming';
  if (item.state === 'cancelled') {
    mappedState = 'cancelled';
  } else if (item.state === 'completed') {
    mappedState = 'completed';
  } else if (item.classSummary.classState === 'in_progress') {
    mappedState = 'in_progress';
  } else if (item.state === 'pending') {
    mappedState = 'upcoming';
  }

  const teacherName = item.classSummary.teacherDisplayName;
  const teacherInitial = teacherName ? teacherName.charAt(0).toUpperCase() : 'T';

  return {
    id: item.bookingId,
    classId: item.classId,
    classTitle: item.classSummary.description,
    skillIcon: 'code',
    teacherName,
    teacherInitial,
    teacherSchoolLabel: 'Đại học Quốc gia',
    startsAt: item.classSummary.startsAt,
    durationMinutes: item.classSummary.durationMinutes,
    priceCredits: item.priceCredits,
    state: mappedState,
    roomCode: item.roomAccessEligible ? `ROOM-${item.bookingId.slice(0, 8)}` : undefined,
    receiptId: `REC-${item.bookingId.slice(0, 8)}`,
  };
}

/**
 * Queries `GET /api/classes/bookings/me` for current authenticated user's real bookings.
 */
export async function fetchMyBookings(): Promise<LearnerBookingView[] | null> {
  try {
    const res = await callApi('/classes/bookings/me');
    if (res.ok) {
      const page = await unwrapEnvelope<MyBookingsPageView>(res);
      if (page && Array.isArray(page.items)) {
        return page.items.map(mapContractBookingToView);
      }
    }
  } catch (err) {
    console.warn('Failed to fetch /api/classes/bookings/me:', err);
  }
  return null;
}
