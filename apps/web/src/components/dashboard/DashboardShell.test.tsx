import { describe, expect, it } from 'vitest';
import { buildDemoSnapshot } from '../../lib/dashboard/mock-data';

/**
 * Smoke test for the dashboard composition.
 *
 * The page itself uses async server components, so a sync
 * `renderToStaticMarkup` cannot be used here without breaking
 * the next-intl server boundary. Instead we pin the invariants
 * the page depends on: the gateway snapshot is well-formed, the
 * booking state distribution matches what the UI branches on,
 * the wallet keeps the BR-027 invariant, and the calendar has
 * exactly 42 cells.
 *
 * Live HTML is exercised by the dev-server smoke test, not by
 * vitest.
 */
describe('Dashboard composition (data layer invariants)', () => {
  it('snapshot exposes the 4 state groups the page branches on', () => {
    const snapshot = buildDemoSnapshot();
    const states = new Set(snapshot.bookings.map((b) => b.state));
    expect(states.has('in_progress')).toBe(true);
    expect(states.has('pending_learner_confirmation')).toBe(true);
    expect(states.has('upcoming')).toBe(true);
    expect(states.has('completed')).toBe(true);
  });

  it('metrics drive the 4 metric tiles', () => {
    const snapshot = buildDemoSnapshot();
    expect(snapshot.metrics.upcomingCount).toBeGreaterThan(0);
    expect(snapshot.metrics.escrowHeldCredits).toBeGreaterThan(0);
    expect(snapshot.metrics.totalCompletedHours).toBeGreaterThan(0);
    expect(snapshot.metrics.monthlyTargetHours).toBeGreaterThan(0);
    expect(snapshot.metrics.pendingReviewCount).toBeGreaterThanOrEqual(0);
  });

  it('wallet keeps the BR-027 invariant', () => {
    const snapshot = buildDemoSnapshot();
    const w = snapshot.wallet;
    expect(w).not.toBeNull();
    expect(w!.availableCredits + w!.heldCredits).toBe(w!.totalCredits);
  });

  it('calendar is a 42-cell grid', () => {
    const snapshot = buildDemoSnapshot();
    expect(snapshot.calendar).toHaveLength(42);
  });

  it('charter has 2 entries', () => {
    const snapshot = buildDemoSnapshot();
    expect(snapshot.charter).toHaveLength(2);
  });

  it('content-guard: snapshot has no banned tokens', () => {
    const snapshot = buildDemoSnapshot();
    const blob = JSON.stringify(snapshot);
    const banned = [
      /Trần Hoàng Mai/,
      /Nguyễn Lê An/,
      /Vũ Minh Hoàng/,
      /Lê Quốc Khánh/,
      /Nguyễn Hà My/,
      /ĐH Bách Khoa/,
      /ĐH Ngoại Thương/,
      /ĐH Kiến Trúc/,
      /GPA 3\.82/,
      /IELTS 8\.0/,
      /voucher\s*10\s*credits/i,
      /bồi thường/i,
      /\+5\s*credits\s*thưởng/i,
      /phản hồi\s*5\s*phút/i,
      /#BK-CS-\d+/i,
      /#ARCH-DES-\d+/i,
      /#TX-\d+/i,
      /SSW-DATA\d+/i,
      /Verifier Thầy Hùng/,
      /100%/,
      /SkillSwap Escrow/i,
      /ví trung gian thông minh/i,
      /Smart-Escrow/i,
    ];
    for (const re of banned) {
      expect(re.test(blob), `banned ${re} in snapshot`).toBe(false);
    }
  });
});
