import { describe, expect, it } from 'vitest';
import { mapContractBookingToView, fetchMyBookings } from './api-my-bookings';
import type { LearnerBookingItemView } from '@skillswap/contracts';

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
});
