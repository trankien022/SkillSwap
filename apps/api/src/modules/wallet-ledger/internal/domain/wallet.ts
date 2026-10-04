import type { ModuleStatusState } from './module-status';

export const DEFAULT_FEE_BPS = 1000;

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
