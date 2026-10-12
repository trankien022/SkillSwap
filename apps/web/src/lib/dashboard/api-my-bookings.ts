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

export const USER_BOOKINGS_STORAGE_KEY = 'skillswap_user_bookings';
export const USER_BOOKINGS_EVENT = 'skillswap:bookings-updated';

export function getLocalUserBookings(): LearnerBookingView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USER_BOOKINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserBooking(booking: LearnerBookingView): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalUserBookings();
    const updated = [booking, ...existing.filter((b) => b.id !== booking.id)];
    localStorage.setItem(USER_BOOKINGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save user booking to localStorage', err);
  }
}

export function dispatchUserBookingsUpdate(booking: LearnerBookingView): void {
  saveUserBooking(booking);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(USER_BOOKINGS_EVENT, { detail: booking }));
  }
}

/**
 * Queries `GET /api/classes/bookings/me` for current authenticated user's real bookings.
 * Merges local browser-stored bookings so newly created bookings appear immediately.
 */
export async function fetchMyBookings(): Promise<LearnerBookingView[] | null> {
  const localBookings = getLocalUserBookings();

  try {
    const res = await callApi('/classes/bookings/me');
    if (res.ok) {
      const page = await unwrapEnvelope<MyBookingsPageView>(res);
      if (page && Array.isArray(page.items)) {
        const mapped = page.items.map(mapContractBookingToView);
        const existingIds = new Set(mapped.map((m) => m.id));
        return [
          ...localBookings.filter((lb) => !existingIds.has(lb.id)),
          ...mapped,
        ];
      }
    }
  } catch (err) {
    console.warn('Failed to fetch /api/classes/bookings/me:', err);
  }

  if (localBookings.length > 0) {
    return localBookings;
  }
  return null;
}
