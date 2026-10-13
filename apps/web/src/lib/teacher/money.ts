import {
  ALLOWED_DURATIONS,
  MAX_CAPACITY,
  MAX_PRICE_CREDITS,
  MIN_CAPACITY,
  MIN_PRICE_CREDITS,
  PLATFORM_FEE_BPS,
  TITLE_MAX_CHARS,
  VND_PER_CREDIT,
  type ClassDraft,
} from './types';

/**
 * Pure pricing and draft-validation helpers for the teacher surfaces (BR-034,
 * BR-017, AC-028).
 *
 * These lived in `mock-data.ts` alongside the demo fixtures, which made them look
 * like mock behavior even though they are the real money rules: the publish
 * preview (`PricingRevenueCard`), the publish form's validity gate and the
 * post-session settlement all depend on them. Keeping them here means there is
 * one arithmetic source, so the 90/10 split cannot drift between screens.
 *
 * Money is integer credits throughout (1 credit = 1,000 VND). No floats.
 */

/* --- Platform fee (BR-034) --- */

/**
 * The platform's cut of a class price: 1000 bps (10%), rounded half-up to an
 * integer credit. An odd price rounds to the nearest credit rather than
 * truncating, so `fee + net === price` always holds.
 */
export function computePlatformFee(priceCredits: number): number {
  return Math.round((priceCredits * PLATFORM_FEE_BPS) / 10_000);
}

/** The teacher's net, i.e. the price minus the platform fee. Never negative. */
export function computeNetCredits(priceCredits: number): number {
  return Math.max(0, priceCredits - computePlatformFee(priceCredits));
}

/** Credits to VND (1 credit = 1,000 VND). Used for the "≈ VNĐ" estimates. */
export function computeVndEstimate(credits: number): number {
  return credits * VND_PER_CREDIT;
}

/* --- Draft clamps and predicates --- */

export function clampPrice(price: number): number {
  if (!Number.isFinite(price)) return MIN_PRICE_CREDITS;
  return Math.max(
    MIN_PRICE_CREDITS,
    Math.min(MAX_PRICE_CREDITS, Math.floor(price)),
  );
}

export function clampCapacity(capacity: number): number {
  if (!Number.isFinite(capacity)) return MIN_CAPACITY;
  return Math.max(
    MIN_CAPACITY,
    Math.min(MAX_CAPACITY, Math.floor(capacity)),
  );
}

export function isAllowedDuration(d: number): boolean {
  return ALLOWED_DURATIONS.includes(d as ClassDraft['durationMinutes']);
}

export function titleCharCount(title: string): number {
  return title.length;
}

export function titleOver(title: string): boolean {
  return titleCharCount(title) > TITLE_MAX_CHARS;
}

export function priceIsValid(price: number): boolean {
  return (
    Number.isFinite(price) &&
    price >= MIN_PRICE_CREDITS &&
    price <= MAX_PRICE_CREDITS &&
    Math.floor(price) === price
  );
}

export function capacityIsValid(capacity: number): boolean {
  return (
    Number.isFinite(capacity) &&
    capacity >= MIN_CAPACITY &&
    capacity <= MAX_CAPACITY &&
    Math.floor(capacity) === capacity
  );
}
