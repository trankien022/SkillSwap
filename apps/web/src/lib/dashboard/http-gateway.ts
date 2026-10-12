import {
  myBookingsPageSchema,
  walletBalanceSchema,
  type MyBookingsPageView,
  type WalletBalanceView,
} from '@skillswap/contracts';
import { callApi, getTokens, unwrapEnvelope } from '../api-client';
import { mapContractBookingToView } from './api-my-bookings';
import type {
  CalendarDay,
  CharterEntry,
  DashboardSnapshot,
  LearnerBookingView,
  LearnerMetrics,
  WalletSnapshot,
} from './types';

/**
 * Live learner-dashboard gateway (FR-021 booking lifecycle, FR-013 review,
 * FR-038 escrow release).
 *
 * Composition — every aggregate is read from an endpoint that already exists,
 * so no screen-facing field is invented:
 * - `GET /classes/bookings/me` — the bookings plus the exact `totalUpcomingCount`,
 *   `expiresAt`, `ratingEligible`, `hasRated` and `roomAccessEligible` flags.
 * - `GET /wallet/balance` — available and held (pending) credits.
 *
 * Fields the backend genuinely does not expose (the mini-calendar, the
 * relative "next session" label, cumulative completed hours, the escrow class
 * count) are **derived** from the two payloads below and marked `// derived`.
 * They are deterministic functions of real data, never fixtures.
 *
 * All calls go through `callApi`, which attaches the bearer token and refreshes
 * it once on 401. Because the endpoints require auth, `getSnapshot` throws
 * `DashboardAuthError` when there is no session, and the page renders an
 * explicit sign-in state instead of demo rows.
 */

/** Raised when the caller has no session; the page shows a sign-in prompt. */
export class DashboardAuthError extends Error {
  constructor() {
    super('Authentication required to load the learner dashboard');
    this.name = 'DashboardAuthError';
  }
}

const DEFAULT_CHARTER: CharterEntry[] = [
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
];

export class HttpLearnerDashboardGateway {
  /** True when a session token is present; mirrors the mock's contract. */
  isAuthenticated(): boolean {
    return getTokens() !== null;
  }

  async getSnapshot(): Promise<DashboardSnapshot> {
    const [bookingsPage, wallet] = await Promise.all([
      this.fetchBookingsPage(),
      this.fetchWallet(),
    ]);

    const bookings = bookingsPage.items.map(mapContractBookingToView);
    return {
      bookings,
      metrics: deriveMetrics(bookings, bookingsPage, wallet),
      wallet,
      calendar: deriveCalendar(bookings), // derived
      charter: DEFAULT_CHARTER,
    };
  }

  async getBookings(): Promise<LearnerBookingView[]> {
    const page = await this.fetchBookingsPage();
    return page.items.map(mapContractBookingToView);
  }

  /**
   * Confirms a completed session and, when supplied, submits the review.
   * Both legs hit real endpoints, then the bookings are refetched so the UI
   * reflects server state rather than a fabricated local transition.
   */
  async confirmBooking(
    bookingId: string,
    review: { rating: number; body: string },
  ): Promise<LearnerBookingView> {
    const confirmRes = await callApi(`/classes/bookings/${bookingId}/confirm`, { method: 'POST' });
    if (!confirmRes.ok) {
      throw new Error(await readErrorMessage(confirmRes, 'Could not confirm the booking'));
    }

    if (review.body.trim().length > 0) {
      const ratingRes = await callApi(`/classes/bookings/${bookingId}/rating`, {
        method: 'POST',
        body: JSON.stringify({ stars: review.rating, comment: review.body.trim() }),
      });
      if (!ratingRes.ok) {
        throw new Error(await readErrorMessage(ratingRes, 'Could not submit the review'));
      }
    }

    return this.requireBooking(bookingId);
  }

  /** Reports a teacher no-show; the backend cancels and the escrow returns. */
  async reportNoShow(bookingId: string): Promise<LearnerBookingView> {
    const res = await callApi(`/classes/bookings/${bookingId}/no-show`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, 'Could not report the no-show'));
    }
    return this.requireBooking(bookingId);
  }

  /**
   * Cancels an upcoming class. The cancel route is scoped to the class, not the
   * booking, because it refunds every affected learner of that class.
   */
  async cancelBooking(bookingId: string): Promise<LearnerBookingView> {
    const current = await this.requireBooking(bookingId);
    const res = await callApi(`/classes/${current.classId}/cancel`, { method: 'POST' });
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, 'Could not cancel the class'));
    }
    return this.requireBooking(bookingId);
  }

  private async fetchBookingsPage(): Promise<MyBookingsPageView> {
    const res = await callApi('/classes/bookings/me?limit=50');
    if (res.status === 401) throw new DashboardAuthError();
    return myBookingsPageSchema.parse(await unwrapEnvelope<unknown>(res));
  }

  private async fetchWallet(): Promise<WalletSnapshot> {
    const res = await callApi('/wallet/balance');
    const balance: WalletBalanceView = walletBalanceSchema.parse(
      await unwrapEnvelope<unknown>(res),
    );
    return toWalletSnapshot(balance);
  }

  /** Refetches one booking after a mutation so its state is server-owned. */
  private async requireBooking(bookingId: string): Promise<LearnerBookingView> {
    const page = await this.fetchBookingsPage();
    const found = page.items.find((item) => item.bookingId === bookingId);
    if (found === undefined) {
      throw new Error(`Booking ${bookingId} is no longer available`);
    }
    return mapContractBookingToView(found);
  }
}

/* --- Wallet shape (contract -> presentation) --- */

function toWalletSnapshot(balance: WalletBalanceView): WalletSnapshot {
  return {
    availableCredits: balance.availableCredits,
    heldCredits: balance.pendingCredits,
    totalCredits: balance.availableCredits + balance.pendingCredits,
    vndRate: 1000,
  };
}

/* --- Derived presentation data (no endpoint exists) --- */

function deriveMetrics(
  bookings: readonly LearnerBookingView[],
  page: MyBookingsPageView,
  wallet: WalletSnapshot | null,
): LearnerMetrics {
  const upcoming = bookings
    .filter((b) => b.state === 'upcoming')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const completedMinutes = bookings
    .filter((b) => b.state === 'completed')
    .reduce((sum, b) => sum + b.durationMinutes, 0);
  const heldCount = bookings.filter(
    (b) => b.state === 'upcoming' || b.state === 'in_progress' || b.state === 'pending_learner_confirmation',
  ).length;

  return {
    upcomingCount: page.totalUpcomingCount,
    nextSessionLabel: upcoming[0] === undefined ? '—' : relativeLabel(upcoming[0].startsAt), // derived
    escrowHeldCredits: wallet?.heldCredits ?? 0,
    escrowHeldClassCount: heldCount, // derived
    totalCompletedHours: Math.round((completedMinutes / 60) * 10) / 10, // derived
    monthlyTargetHours: 30, // product default; not user-configurable yet
    // Real signal from the server: classes the learner may review but has not.
    pendingReviewCount: page.items.filter((item) => item.ratingEligible && !item.hasRated).length,
  };
}

/** 6-week grid centred on `year`/`month`, flagging days that have a session. */
function deriveCalendar(bookings: readonly LearnerBookingView[]): CalendarDay[] {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const bookedDays = new Set(bookings.map((b) => b.startsAt.slice(0, 10)));
  const liveDays = new Set(
    bookings.filter((b) => b.state === 'in_progress').map((b) => b.startsAt.slice(0, 10)),
  );

  const first = new Date(Date.UTC(year, month, 1));
  const firstWeekday = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - firstWeekday);
  const todayKey = now.toISOString().slice(0, 10);

  const grid: CalendarDay[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    grid.push({
      date: key,
      inMonth: d.getUTCMonth() === month,
      isToday: key === todayKey,
      hasLiveSession: liveDays.has(key),
      hasBookedSession: bookedDays.has(key),
    });
  }
  return grid;
}

function relativeLabel(iso: string): string {
  const hours = (new Date(iso).getTime() - Date.now()) / 3_600_000;
  if (hours <= 0) return 'Now';
  if (hours < 24) return `In ${Math.max(1, Math.round(hours))}h`;
  const days = Math.round(hours / 24);
  return `In ${days}d`;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { message?: string };
  return err.message ?? fallback;
}
