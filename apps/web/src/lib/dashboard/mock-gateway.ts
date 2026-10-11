import {
  buildDemoSnapshot,
  demoCalendar,
  demoLearnerMetrics,
  demoWalletSnapshot,
} from './mock-data';
import type {
  DashboardSnapshot,
  LearnerBookingView,
  WalletSnapshot,
} from './types';

/**
 * Mock learner-dashboard gateway (FR-021 booking lifecycle,
 * FR-013 review, FR-038 escrow release).
 *
 * No network. The pilot has no auth, so the wallet snapshot is
 * still returned but the page renders a "sign in" placeholder on
 * top of it (see `WalletLedgerWidget`). When the real
 * `HttpLearnerDashboardGateway` lands, the only change is the
 * class instantiation in the page.
 */
export class MockLearnerDashboardGateway {
  private bookings: LearnerBookingView[];
  private metrics = demoLearnerMetrics();
  private wallet: WalletSnapshot | null = demoWalletSnapshot();

  constructor(snapshot: DashboardSnapshot = buildDemoSnapshot()) {
    this.bookings = snapshot.bookings;
    this.metrics = snapshot.metrics;
    this.wallet = snapshot.wallet;
  }

  /** Toggle for the no-auth pilot. The real adapter will read the
   * session and either return a snapshot or throw 401. */
  setWallet(snapshot: WalletSnapshot | null): void {
    this.wallet = snapshot;
  }

  async getSnapshot(): Promise<DashboardSnapshot> {
    return {
      bookings: [...this.bookings],
      metrics: { ...this.metrics },
      wallet: this.wallet ? { ...this.wallet } : null,
      calendar: demoCalendar(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
      ),
      charter: [
        {
          icon: 'timer_off',
          title: '15-minute teacher no-show rule',
          body: 'If the teacher has not joined the room 15 minutes after the start time, the system will automatically return the held credits to your wallet.',
        },
        {
          icon: 'lock_person',
          title: 'Keep all contact inside the platform',
          body: 'Every message, file share and video call stays inside SkillSwap so the support team has a full record if a dispute is opened.',
        },
      ],
    };
  }

  async getBookings(): Promise<LearnerBookingView[]> {
    return [...this.bookings];
  }

  /**
   * Confirm a PENDING booking as completed and submit a review.
   * Mirrors the BE's confirm + review flow (FR-021, FR-013). The
   * held credits are considered released to the teacher.
   */
  async confirmBooking(
    bookingId: string,
    review: { rating: number; body: string },
  ): Promise<LearnerBookingView> {
    const idx = this.bookings.findIndex((b) => b.id === bookingId);
    if (idx === -1) throw new Error(`Booking not found: ${bookingId}`);
    const current = this.bookings[idx];
    if (!current) throw new Error(`Booking not found: ${bookingId}`);
    if (current.state !== 'pending_learner_confirmation') {
      throw new Error(
        `Cannot confirm booking in state ${current.state}; only pending_learner_confirmation is allowed`,
      );
    }
    const updated: LearnerBookingView = {
      ...current,
      state: 'completed',
      reviewSubmitted: {
        rating: review.rating,
        body: review.body,
        submittedOn: new Date().toISOString(),
      },
      receiptId: `rcpt-demo-${bookingId.slice(-4)}`,
    };
    this.bookings[idx] = updated;
    this.metrics = {
      ...this.metrics,
      pendingReviewCount: Math.max(0, this.metrics.pendingReviewCount - 1),
    };
    return { ...updated };
  }

  /** Mark a PENDING booking as a teacher no-show. Held credits
   * return to the learner; the next ledger pass releases them. */
  async reportNoShow(bookingId: string): Promise<LearnerBookingView> {
    const idx = this.bookings.findIndex((b) => b.id === bookingId);
    if (idx === -1) throw new Error(`Booking not found: ${bookingId}`);
    const current = this.bookings[idx];
    if (!current) throw new Error(`Booking not found: ${bookingId}`);
    if (current.state !== 'pending_learner_confirmation') {
      throw new Error(
        `Cannot report no-show for booking in state ${current.state}`,
      );
    }
    const updated: LearnerBookingView = {
      ...current,
      state: 'no_show_reported',
      receiptId: `rcpt-demo-${bookingId.slice(-4)}`,
    };
    this.bookings[idx] = updated;
    return { ...updated };
  }

  /** Cancel an UPCOMING booking; held credits return to the
   * wallet (BR-021 / AC-022). */
  async cancelBooking(bookingId: string): Promise<LearnerBookingView> {
    const idx = this.bookings.findIndex((b) => b.id === bookingId);
    if (idx === -1) throw new Error(`Booking not found: ${bookingId}`);
    const current = this.bookings[idx];
    if (!current) throw new Error(`Booking not found: ${bookingId}`);
    if (current.state !== 'upcoming') {
      throw new Error(
        `Cannot cancel booking in state ${current.state}; only upcoming is allowed`,
      );
    }
    const updated: LearnerBookingView = {
      ...current,
      state: 'cancelled',
      receiptId: `rcpt-demo-${bookingId.slice(-4)}`,
    };
    this.bookings[idx] = updated;
    return { ...updated };
  }

  /** True if a learner is currently signed in. The mock always
   * returns false until the real session is wired. */
  isAuthenticated(): boolean {
    return false;
  }
}
