import type { ModuleStatusState } from './module-status';

export const DEFAULT_FEE_BPS = 1000;
export const VND_PER_CREDIT = 1000;

export interface FeeSplit {
  platformFeeCredits: number;
  teacherCredits: number;
}

/** Integer credit math — 1 credit = 1,000 VND, no rounding drift (§4 money rule). */
export function applyPlatformFee(amountCredits: number, feeBps: number = DEFAULT_FEE_BPS): FeeSplit {
  if (!Number.isInteger(amountCredits) || amountCredits <= 0) {
    throw new RangeError(`amountCredits must be a positive integer, got ${amountCredits}`);
  }
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new RangeError(`feeBps must be an integer within [0, 10000], got ${feeBps}`);
  }
  const platformFeeCredits = Math.floor((amountCredits * feeBps) / 10_000);
  return { platformFeeCredits, teacherCredits: amountCredits - platformFeeCredits };
}

export function canWithdraw(state: ModuleStatusState): boolean {
  return state === 'active';
}

// ── FR-008 wallet top-up (ADR-017) ──────────────────────────────────────────

export const TOP_UP_STATUSES = ['pending', 'settled', 'failed', 'reversed'] as const;
export type TopUpStatus = (typeof TOP_UP_STATUSES)[number];

/** Monotonic rank so an older callback can be acknowledged but never applied. */
export const TOP_UP_STATUS_RANK: Readonly<Record<TopUpStatus, number>> = {
  pending: 0,
  settled: 1,
  failed: 1,
  reversed: 2,
};

export function isTopUpStatus(value: string): value is TopUpStatus {
  return (TOP_UP_STATUSES as readonly string[]).includes(value);
}

export function topUpStatusRank(status: TopUpStatus): number {
  return TOP_UP_STATUS_RANK[status];
}

/** Whether a callback moves an intent forward (equal rank is a replay no-op). */
export function canAdvanceTopUp(from: TopUpStatus, to: TopUpStatus): boolean {
  return topUpStatusRank(to) > topUpStatusRank(from);
}

export class InvalidTopUpAmountError extends Error {
  constructor(amountVnd: number) {
    super(`Top-up amount must be a positive integer number of VND, got ${amountVnd}`);
    this.name = 'InvalidTopUpAmountError';
  }
}

/** Converts VND to whole credits; the MVP rate is fixed (ADR-017). */
export function vndToCredits(amountVnd: number, vndPerCredit: number = VND_PER_CREDIT): number {
  if (!Number.isInteger(amountVnd) || amountVnd <= 0) {
    throw new InvalidTopUpAmountError(amountVnd);
  }
  if (!Number.isInteger(vndPerCredit) || vndPerCredit <= 0) {
    throw new RangeError(`vndPerCredit must be a positive integer, got ${vndPerCredit}`);
  }
  if (amountVnd % vndPerCredit !== 0) {
    throw new InvalidTopUpAmountError(amountVnd);
  }
  return amountVnd / vndPerCredit;
}

export interface WalletBalance {
  availableCredits: number;
  pendingCredits: number;
}

export class InsufficientBalanceError extends Error {
  constructor(available: number, required: number) {
    super(`Insufficient balance: available ${available}, required ${required}`);
    this.name = 'InsufficientBalanceError';
  }
}

/** Spending is blocked while the wallet is in deficit (ADR-017 reversal rule). */
export function assertCanSpend(balance: number, amount: number): void {
  if (balance < 0 || amount > balance) {
    throw new InsufficientBalanceError(balance, amount);
  }
}

// ── FR-009 booking settlement (ADR-018) ─────────────────────────────────────

export const SETTLEMENT_ENTRY_TYPES = [
  'learner_debit',
  'teacher_pending',
  'platform_fee',
  'release',
] as const;
export type SettlementEntryType = (typeof SETTLEMENT_ENTRY_TYPES)[number];

export interface SettlementSplit {
  teacherCredits: number;
  platformFeeCredits: number;
}

/**
 * FR-009 / OQ-012 (ADR-018): the 90/10 split with floor-fee rounding and the
 * exact integer invariant `teacher + fee == price` (remainder to the Teacher).
 */
export function splitSettlement(priceCredits: number, feeBps: number = DEFAULT_FEE_BPS): SettlementSplit {
  const { platformFeeCredits, teacherCredits } = applyPlatformFee(priceCredits, feeBps);
  return { teacherCredits, platformFeeCredits };
}
