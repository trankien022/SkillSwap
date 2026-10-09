import type { WalletBalance } from '../../../domain/wallet';

export const WALLET_REPOSITORY = Symbol('WalletRepository');

export interface ApplyTopUpRequest {
  readonly ownerId: string;
  readonly intentId: string;
  readonly amountCredits: number;
  readonly direction: 'credit' | 'debit';
  readonly traceId: string;
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
}
