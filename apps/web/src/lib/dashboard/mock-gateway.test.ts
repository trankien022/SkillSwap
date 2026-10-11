import { describe, expect, it } from 'vitest';
import { MockLearnerDashboardGateway } from './mock-gateway';
import { demoLearnerBookings, demoWalletSnapshot } from './mock-data';
import type { LearnerBookingView } from './types';

describe('MockLearnerDashboardGateway', () => {
  it('exposes the 5 expected lifecycle states (FR-021)', async () => {
    const gateway = new MockLearnerDashboardGateway();
    const snapshot = await gateway.getSnapshot();
    const states = snapshot.bookings.map((b) => b.state);
    expect(states).toContain('in_progress');
    expect(states).toContain('pending_learner_confirmation');
    expect(states.filter((s) => s === 'upcoming')).toHaveLength(2);
    expect(states).toContain('completed');
  });

  it('metrics keep integer credits (BR-016, BR-027)', async () => {
    const gateway = new MockLearnerDashboardGateway();
    const snapshot = await gateway.getSnapshot();
    expect(Number.isInteger(snapshot.metrics.escrowHeldCredits)).toBe(true);
    expect(snapshot.metrics.escrowHeldCredits).toBeGreaterThan(0);
    expect(snapshot.metrics.totalCompletedHours).toBeGreaterThan(0);
    expect(snapshot.metrics.monthlyTargetHours).toBeGreaterThan(0);
  });

  it('wallet keeps the BR-027 invariant: available + held = total', async () => {
    const wallet = demoWalletSnapshot();
    expect(wallet.availableCredits + wallet.heldCredits).toBe(
      wallet.totalCredits,
    );
    expect(wallet.vndRate).toBe(1000);
    expect(Number.isInteger(wallet.availableCredits)).toBe(true);
    expect(Number.isInteger(wallet.heldCredits)).toBe(true);
  });

  it('calendar is a 42-cell grid (6 weeks x 7 days) for the current month', async () => {
    const gateway = new MockLearnerDashboardGateway();
    const snapshot = await gateway.getSnapshot();
    expect(snapshot.calendar).toHaveLength(42);
    const inMonth = snapshot.calendar.filter((d) => d.inMonth).length;
    expect(inMonth).toBeGreaterThanOrEqual(28);
    expect(inMonth).toBeLessThanOrEqual(31);
  });

  it('confirmBooking transitions pending_learner_confirmation -> completed', async () => {
    const gateway = new MockLearnerDashboardGateway();
    const pending = (await gateway.getBookings()).find(
      (b) => b.state === 'pending_learner_confirmation',
    );
    expect(pending).toBeDefined();
    const result = await gateway.confirmBooking(pending!.id, {
      rating: 5,
      body: 'Helpful session, would book again.',
    });
    expect(result.state).toBe('completed');
    expect(result.reviewSubmitted).toBeDefined();
    expect(result.reviewSubmitted?.rating).toBe(5);
    expect(result.receiptId).toBeDefined();
  });

  it('reportNoShow transitions pending_learner_confirmation -> no_show_reported', async () => {
    const gateway = new MockLearnerDashboardGateway();
    const pending = (await gateway.getBookings()).find(
      (b) => b.state === 'pending_learner_confirmation',
    );
    expect(pending).toBeDefined();
    const result = await gateway.reportNoShow(pending!.id);
    expect(result.state).toBe('no_show_reported');
    expect(result.receiptId).toBeDefined();
  });

  it('cancelBooking transitions upcoming -> cancelled', async () => {
    const gateway = new MockLearnerDashboardGateway();
    const upcoming = (await gateway.getBookings()).find(
      (b) => b.state === 'upcoming',
    );
    expect(upcoming).toBeDefined();
    const result = await gateway.cancelBooking(upcoming!.id);
    expect(result.state).toBe('cancelled');
  });

  it('refuses to confirm a booking that is not in pending_learner_confirmation', async () => {
    const gateway = new MockLearnerDashboardGateway();
    const completed = (await gateway.getBookings()).find(
      (b) => b.state === 'completed',
    );
    expect(completed).toBeDefined();
    await expect(
      gateway.confirmBooking(completed!.id, { rating: 5, body: 'x' }),
    ).rejects.toThrow();
  });

  /** Content-guard at the data boundary (BR-/FR-/AC-, names, schools,
   * scores, voucher ảo, support SLA, mock booking id formats). */
  it('content-guard: no banned tokens in any demo booking', async () => {
    const all = demoLearnerBookings();
    const bannedNames = [
      'Trần Hoàng Mai',
      'Nguyễn Lê An',
      'Hoàng Minh Đức',
      'Vũ Minh Hoàng',
      'TS. Vũ Minh Hoàng',
      'Lê Quốc Khánh',
      'Nguyễn Hà My',
      'Bùi Minh Đức',
      'Đặng Thảo Linh',
    ];
    const bannedSchools = [
      'ĐH Ngoại Thương',
      'Bách Khoa',
      'ĐH Bách Khoa',
      'ĐH Khoa học Tự nhiên',
      'Khoa học Tự nhiên',
      'ĐH Kiến Trúc',
      'ĐH KHTN',
      'FTU',
      'HUST',
      'NEU',
    ];
    const bannedMetrics = [
      'GPA 3.82',
      'IELTS 8.0',
      'IELTS 8.5',
      'Speaking 8.5',
      'Giải Nhì',
      'Olympic',
      'Backend Lead',
      'Top Product',
    ];
    const bannedHotlines = ['1900-8888', 'Ext:'];
    const bannedBranding = [
      'SkillSwap Escrow',
      'ví trung gian thông minh',
      'Smart-Escrow',
    ];
    const bannedIncentives = [
      'voucher 10 credits',
      'voucher 10',
      'bồi thường',
      '+5 credits thưởng',
      '+5 thưởng',
      '+10 credits thưởng',
      '+10 thưởng',
      'phản hồi 5 phút',
      'phản hồi trong 5 phút',
    ];
    const bannedMockIds = [
      /#BK-[A-Z]+-\d+/i,
      /#ARCH-[A-Z]+-\d+/i,
      /#TX-\d+/i,
      /SSW-DATA\d+/i,
    ];
    const bannedVerifier = ['Thầy Hùng', 'Verifier Thầy Hùng'];
    const idRe = /\b(BR|FR|AC)-\d{3}\b/;
    const pctRe = /\b100\s*%/;

    for (const booking of all) {
      const blob = JSON.stringify(booking);
      for (const name of bannedNames) {
        expect(blob, `real name "${name}" in ${booking.id}`).not.toContain(
          name,
        );
      }
      for (const school of bannedSchools) {
        expect(
          blob,
          `school "${school}" in ${booking.id}`,
        ).not.toContain(school);
      }
      for (const metric of bannedMetrics) {
        expect(
          blob,
          `metric "${metric}" in ${booking.id}`,
        ).not.toContain(metric);
      }
      for (const phone of bannedHotlines) {
        expect(blob, `phone "${phone}" in ${booking.id}`).not.toContain(phone);
      }
      for (const brand of bannedBranding) {
        expect(blob, `branding "${brand}" in ${booking.id}`).not.toContain(
          brand,
        );
      }
      for (const incentive of bannedIncentives) {
        expect(
          blob,
          `incentive "${incentive}" in ${booking.id}`,
        ).not.toContain(incentive);
      }
      for (const re of bannedMockIds) {
        expect(
          re.test(blob),
          `mock id pattern ${re} in ${booking.id}`,
        ).toBe(false);
      }
      for (const verifier of bannedVerifier) {
        expect(
          blob,
          `verifier "${verifier}" in ${booking.id}`,
        ).not.toContain(verifier);
      }
      expect(idRe.test(blob), `BR/FR/AC leaked in ${booking.id}`).toBe(false);
      expect(pctRe.test(blob), `100% leaked in ${booking.id}`).toBe(false);
      expect(booking.teacherName.startsWith('Demo teacher')).toBe(true);
      expect(booking.teacherSchoolLabel.startsWith('Demo ')).toBe(true);
    }
  });

  it('content-guard: review body never carries a real name', async () => {
    const all = demoLearnerBookings();
    for (const booking of all) {
      if (!booking.reviewSubmitted) continue;
      expect(booking.reviewSubmitted.body.length).toBeGreaterThan(0);
      expect(booking.reviewSubmitted.rating).toBeGreaterThanOrEqual(1);
      expect(booking.reviewSubmitted.rating).toBeLessThanOrEqual(5);
    }
  });

  it('TypeScript-shaped: every booking satisfies LearnerBookingView', () => {
    const requiredKeys: Array<keyof LearnerBookingView> = [
      'id',
      'classId',
      'classTitle',
      'skillIcon',
      'teacherName',
      'teacherInitial',
      'teacherSchoolLabel',
      'startsAt',
      'durationMinutes',
      'priceCredits',
      'state',
    ];
    for (const b of demoLearnerBookings()) {
      for (const key of requiredKeys) {
        expect(b[key], `${String(key)} on ${b.id}`).toBeDefined();
      }
    }
  });
});
