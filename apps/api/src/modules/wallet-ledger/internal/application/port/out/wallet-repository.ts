import type { WalletBalance } from '../../../domain/wallet';

export const WALLET_REPOSITORY = Symbol('WalletRepository');

export interface ApplyTopUpRequest {
  readonly ownerId: string;
  readonly intentId: string;
  readonly amountCredits: number;
  readonly direction: 'credit' | 'debit';
  readonly traceId: string;
}

export interface SettleBookingRequest {
  readonly bookingId: string;
  readonly learnerId: string;
  readonly teacherId: string;
  readonly priceCredits: number;
  readonly teacherCredits: number;
  readonly platformFeeCredits: number;
  readonly traceId: string;
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
   */
  applyTopUp(request: ApplyTopUpRequest): Promise<WalletBalance>;
  /**
   * FR-009 (ADR-018): debits the Learner, credits the Teacher's pending income
   * and records the platform fee in one transaction; a second call for the
   * same booking is a no-op. Throws if the Learner's balance is insufficient.
   */
  settleBooking(request: SettleBookingRequest): Promise<SettleBookingResult>;
  /** FR-009: moves pending income to available, once per (booking, releaseKey). */
  releaseIncome(request: ReleaseIncomeRequest): Promise<ReleaseIncomeResult>;
  /**
   * FR-007 / AC-022/AC-027 (ADR-019): refunds a settled booking — credits the
   * Learner, reduces the Teacher's pending income and reverses the fee, once
   * per booking. A no-op for a booking that was never settled.
   */
  refundBooking(request: RefundBookingRequest): Promise<RefundBookingResult>;
}
