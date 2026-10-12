import { describe, expect, it } from 'vitest';
import {
  mapContractBookingToView,
  fetchMyBookings,
  saveUserBooking,
  getLocalUserBookings,
  USER_BOOKINGS_STORAGE_KEY,
} from './api-my-bookings';
import type { LearnerBookingItemView } from '@skillswap/contracts';
import type { LearnerBookingView } from './types';

describe('api-my-bookings', () => {
  const sampleContractItem: LearnerBookingItemView = {
    bookingId: 'bkg-1234-5678',
    classId: 'cls-9876-5432',
    state: 'confirmed',
    priceCredits: 60,
    createdAt: '2026-10-10T08:00:00.000Z',
    expiresAt: null,
    classSummary: {
      description: 'Luyện thi chứng chỉ AWS Cloud Practitioner',
      skillIds: ['skill-cloud-1'],
      startsAt: '2026-10-22T19:00:00.000Z',
      durationMinutes: 90,
      teacherId: 'teacher-cloud',
      teacherDisplayName: 'Nguyễn Thành Nam',
      classState: 'published',
    },
    roomAccessEligible: true,
    ratingEligible: false,
    hasRated: false,
  };

  it('maps backend LearnerBookingItemView to UI LearnerBookingView correctly', () => {
    const view = mapContractBookingToView(sampleContractItem);
    expect(view.id).toBe('bkg-1234-5678');
    expect(view.classId).toBe('cls-9876-5432');
    expect(view.classTitle).toBe('Luyện thi chứng chỉ AWS Cloud Practitioner');
    expect(view.teacherName).toBe('Nguyễn Thành Nam');
    expect(view.teacherInitial).toBe('N');
    expect(view.priceCredits).toBe(60);
    expect(view.state).toBe('upcoming');
    expect(view.roomCode).toBe('ROOM-bkg-1234');
  });

  it('handles network failure gracefully without throwing', async () => {
    const result = await fetchMyBookings();
    expect(result).toBeNull();
  });

  it('saves and retrieves local user bookings from storage', () => {
    const mockItem: LearnerBookingView = {
      id: 'bkg-test-local-1',
      classId: 'cls-test-1',
      classTitle: 'Lớp học lập trình Next.js',
      skillIcon: 'code',
      teacherName: 'Giảng viên Test',
      teacherInitial: 'G',
      teacherSchoolLabel: 'Đại học Quốc gia',
      startsAt: '2026-10-30T10:00:00.000Z',
      durationMinutes: 60,
      priceCredits: 50,
      state: 'upcoming',
    };

    saveUserBooking(mockItem);
    const stored = getLocalUserBookings();
    expect(stored.some((b: any) => b.id === 'bkg-test-local-1')).toBe(true);

    // Clean up
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(USER_BOOKINGS_STORAGE_KEY);
    }
  });
});
