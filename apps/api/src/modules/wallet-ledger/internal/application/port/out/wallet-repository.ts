import type { WalletBalance } from '../../../domain/wallet';

export const WALLET_REPOSITORY = Symbol('WalletRepository');

export interface ApplyTopUpRequest {
  readonly ownerId: string;
  readonly intentId: string;
  readonly amountCredits: number;
  readonly direction: 'credit' | 'debit';
  readonly traceId: string;
  /**
   * ADR-035: who acted. A SePay IPN is a settlement confirmed by the provider, not by a person,
   * so it is `SYSTEM_ACTOR_ID`; `ownerId` remains the **beneficiary**. They are separate fields
   * because the person whose balance moved did not authorise it.
   */
  readonly actorId: string;
}

export interface SettleBookingRequest {
  readonly bookingId: string;
  readonly learnerId: string;
  readonly teacherId: string;
  readonly priceCredits: number;
  readonly teacherCredits: number;
  readonly platformFeeCredits: number;
  readonly traceId: string;
  /**
   * ADR-035: who acted. Settlement is driven by the `booking.confirmed` consumer rather than by a
   * request, so it is `SYSTEM_ACTOR_ID` — and it is passed in rather than imported here so the
   * wallet module does not make the audit decision itself.
   */
  readonly actorId: string;
}

export interface SettleBookingResult {
  /** False when this booking was already settled (idempotent replay). */
  readonly applied: boolean;
  readonly teacherCredits: number;
  readonly platformFeeCredits: number;
}

export interface ReleaseIncomeRequest {
  readonly bookingId: string;
  readonly teacherId: string;
  readonly amountCredits: number;
  readonly releaseKey: string;
  readonly traceId: string;
  /**
   * B11 / ADR-035: who caused the release. A `class.completed` is a system effect, so it is
   * `SYSTEM_ACTOR_ID`; `teacherId` is the **beneficiary** and is a different fact. Passed in
   * rather than imported so the wallet module does not make the audit decision itself.
   */
  readonly actorId: string;
}

export interface ReleaseIncomeResult {
  readonly applied: boolean;
}

export interface RefundBookingRequest {
  readonly bookingId: string;
  readonly learnerId: string;
  readonly teacherId: string;
  readonly priceCredits: number;
  readonly traceId: string;
  /**
   * B11 / ADR-035: who caused the refund. A `booking.cancelled` consumer drives it, so it is
   * `SYSTEM_ACTOR_ID`; `learnerId` is the beneficiary.
   */
  readonly actorId: string;
}

export interface RefundBookingResult {
  /** False when the booking was never settled (nothing to refund) or already refunded. */
  readonly applied: boolean;
}

export interface WalletRepository {
  /** Current balance, defaulting to zero for an owner with no row yet. */
  getBalance(ownerId: string): Promise<WalletBalance>;
  /** Applies a signed delta to available credits atomically. */
  addAvailable(ownerId: string, deltaCredits: number): Promise<WalletBalance>;
  /**
   * FR-008: applies a top-up/reversal to the balance AND appends its ledger
   * entry in one transaction, so the two can never diverge (ADR-017).
   *
   * B11: a credit emits `top_up` and a debit emits `reversal`, both inside that
   * transaction, so neither movement is silent.
   */
  applyTopUp(request: ApplyTopUpRequest): Promise<WalletBalance>;
  /**
   * FR-009 (ADR-018): debits the Learner, credits the Teacher's pending income
   * and records the platform fee in one transaction; a second call for the
   * same booking is a no-op. Throws if the Learner's balance is insufficient.
   */
  settleBooking(request: SettleBookingRequest): Promise<SettleBookingResult>;
  /**
   * FR-009: moves pending income to available, once per (booking, releaseKey).
   * B11: an applied release emits `income_release`; the idempotent no-op does not.
   */
  releaseIncome(request: ReleaseIncomeRequest): Promise<ReleaseIncomeResult>;
  /**
   * FR-007 / AC-022/AC-027 (ADR-019): refunds a settled booking — credits the
   * Learner, reduces the Teacher's pending income and reverses the fee, once
   * per booking. A no-op for a booking that was never settled.
   * B11: an applied refund emits `booking_refund`; the no-ops do not.
   */
  refundBooking(request: RefundBookingRequest): Promise<RefundBookingResult>;
}
