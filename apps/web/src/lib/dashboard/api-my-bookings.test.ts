import { describe, expect, it } from 'vitest';
import { mapContractBookingToView, toPresentationState } from './api-my-bookings';
import type { LearnerBookingItemView } from '@skillswap/contracts';

function item(overrides: Partial<LearnerBookingItemView> = {}): LearnerBookingItemView {
  return {
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
    ...overrides,
  };
}

describe('mapContractBookingToView', () => {
  it('maps a backend booking item into the presentation model', () => {
    const view = mapContractBookingToView(item());
    expect(view.id).toBe('bkg-1234-5678');
    expect(view.classId).toBe('cls-9876-5432');
    expect(view.classTitle).toBe('Luyện thi chứng chỉ AWS Cloud Practitioner');
    expect(view.teacherName).toBe('Nguyễn Thành Nam');
    expect(view.teacherInitial).toBe('N');
    expect(view.priceCredits).toBe(60);
    // No fabricated room code — the room is minted on demand by
    // `POST /classes/bookings/{bookingId}/room-access` (TASK-03 Phase 2).
    expect(view).not.toHaveProperty('roomCode');
  });

  it('falls back to a neutral teacher initial when the display name is blank', () => {
    const view = mapContractBookingToView(
      item({ classSummary: { ...item().classSummary, teacherDisplayName: '' } as never }),
    );
    expect(view.teacherInitial).toBe('T');
  });

  it('does not fabricate a receipt id for completed bookings', () => {
    // No receipt endpoint exists yet (FR-014 family). The dashboard renders an
    // explicit "not yet available" state instead of a synthetic value.
    const view = mapContractBookingToView(item({ state: 'completed' }));
    expect(view).not.toHaveProperty('receiptId');
  });
});

describe('toPresentationState', () => {
  it('keeps a confirmed booking whose class has not started as upcoming', () => {
    const future = new Date(Date.now() + 3 * 3_600_000).toISOString();
    const it0 = item({ classSummary: { ...item().classSummary, startsAt: future } as never });
    expect(toPresentationState(it0)).toBe('upcoming');
  });

  it('surfaces a finished but unconfirmed booking as pending learner confirmation', () => {
    const past = new Date(Date.now() - 5 * 3_600_000).toISOString();
    const done = item({
      expiresAt: new Date(Date.now() + 12 * 3_600_000).toISOString(),
      classSummary: { ...item().classSummary, startsAt: past, durationMinutes: 60 } as never,
    });
    expect(toPresentationState(done)).toBe('pending_learner_confirmation');
  });

  it('passes the terminal backend states straight through', () => {
    expect(toPresentationState(item({ state: 'completed' }))).toBe('completed');
    expect(toPresentationState(item({ state: 'cancelled' }))).toBe('cancelled');
  });
});
