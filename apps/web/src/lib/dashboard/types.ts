/* --- Learner dashboard types (FR-021 booking lifecycle, FR-013 review) --- */

/**
 * Lifecycle state of a booking as seen by the learner.
 *
 * Mapped 1-1 to the backend's booking state with one extra
 * `pending_learner_confirmation` (BR-043) so the UI can branch on
 * "the class is over and the learner still has to confirm" before
 * the auto-release window (AC-024) closes.
 */
export type BookingState =
  | 'pending_learner_confirmation'
  | 'upcoming'
  | 'in_progress'
  | 'completed'
  | 'released'
  | 'no_show_reported'
  | 'cancelled'
  | 'refunded';

/** Coarse glyph key for the class icon (DESIGN.md no real images). */
export type SkillIcon =
  | 'language'
  | 'code'
  | 'design'
  | 'math'
  | 'business'
  | 'science';

/** A booking the learner can see on the dashboard. */
export interface LearnerBookingView {
  id: string;
  classId: string;
  classTitle: string;
  skillIcon: SkillIcon;
  teacherName: string;
  teacherInitial: string;
  teacherSchoolLabel: string;
  startsAt: string; // ISO
  durationMinutes: number;
  priceCredits: number;
  state: BookingState;

  /** Seconds until the escrow auto-releases (PENDING only). */
  autoReleaseCountdownSeconds?: number;

  /** Generated room code (mock; the real backend mints per booking). */
  roomCode?: string;

  /** When the learner already submitted a review after completion. */
  reviewSubmitted?: {
    rating: number;
    body: string;
    submittedOn: string;
  };

  /** When the booking is past, the receipt id is shown. */
  receiptId?: string;
}

/** The four big metric tiles at the top of the dashboard. */
export interface LearnerMetrics {
  upcomingCount: number;
  nextSessionLabel: string; // e.g. "Tonight 19:30"
  escrowHeldCredits: number;
  escrowHeldClassCount: number;
  totalCompletedHours: number;
  monthlyTargetHours: number;
  pendingReviewCount: number;
}

/** A snapshot of the wallet + escrow ledger. */
export interface WalletSnapshot {
  availableCredits: number;
  heldCredits: number;
  totalCredits: number;
  vndRate: number; // credits * rate = VND
}

/** A single day on the mini-calendar. */
export interface CalendarDay {
  date: string; // ISO yyyy-mm-dd
  inMonth: boolean;
  isToday: boolean;
  hasLiveSession: boolean;
  hasBookedSession: boolean;
}

/** A single rule card in the Learner Charter widget. */
export interface CharterEntry {
  icon: 'timer_off' | 'lock_person' | 'support_agent' | 'gavel';
  title: string;
  body: string;
}

/** Aggregated dashboard payload (single round-trip in the future). */
export interface DashboardSnapshot {
  bookings: LearnerBookingView[];
  metrics: LearnerMetrics;
  wallet: WalletSnapshot | null; // null when no auth
  calendar: CalendarDay[];
  charter: CharterEntry[];
}
