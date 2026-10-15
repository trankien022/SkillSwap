import { callApiOk, unwrapEnvelope } from '../api-client';
import type { WalletBalanceView } from '@skillswap/contracts';
import type { ClassDetailView } from '../marketplace/types';
import { newIdempotencyKey } from './idempotency';
import type { BookClassService } from './service';

/**
 * The balance gate, in one place (plan §2.3).
 *
 * There is no synchronous server-side credit check to call, so the decision is
 * composed on the client from two honest reads: the class's price, which the
 * page already has, and a *fresh* `/wallet/balance`, which it does not. Both the
 * class detail action and the checkout branch run this, so the two can never
 * disagree about what "affordable" means or drift apart as the flow changes.
 *
 * A balance that cannot be read is **not** treated as affordable: it fails the
 * gate, because the alternative is attempting a debit the learner may not be
 * able to pay for. `unknown` stays closed, exactly like the booking verdict.
 */

/** What the gate decided, and the price it decided against. */
export type BalanceGate =
  | { decision: 'sufficient'; availableCredits: number; priceCredits: number; shortfall: 0 }
  | { decision: 'short'; availableCredits: number; priceCredits: number; shortfall: number }
  /** No readable balance — sent down the same path as `short`, never as enough. */
  | { decision: 'unreadable'; priceCredits: number };

/** Reads the learner's spendable credits. Injectable so tests need no network. */
export type ReadAvailableCredits = () => Promise<number>;

/** The production reader: the wallet route, never a cached or derived number. */
export async function readAvailableCredits(): Promise<number> {
  const res = await callApiOk('/wallet/balance');
  const balance = await unwrapEnvelope<WalletBalanceView>(res);
  return balance.availableCredits;
}

/**
 * The gate's decision, as a pure function of two numbers the page already has.
 *
 * Split out from `checkBalanceGate` for the checkout page, which renders from
 * the class detail and the balance it already fetched: it must reach the *same*
 * verdict the class detail action reached at press time, without issuing a
 * second balance read on every render. One comparison, two entry points.
 */
export function decideGate(priceCredits: number, availableCredits: number): BalanceGate {
  if (availableCredits >= priceCredits) {
    return { decision: 'sufficient', availableCredits, priceCredits, shortfall: 0 };
  }
  return {
    decision: 'short',
    availableCredits,
    priceCredits,
    shortfall: priceCredits - availableCredits,
  };
}

/**
 * Compares the class price against a fresh balance read.
 *
 * `shortfall` is the exact number of Credits the learner is missing, so the
 * checkout page can state a real amount instead of an invented one.
 */
export async function checkBalanceGate(
  priceCredits: number,
  read: ReadAvailableCredits = readAvailableCredits,
): Promise<BalanceGate> {
  let availableCredits: number;
  try {
    availableCredits = await read();
  } catch {
    return { decision: 'unreadable', priceCredits };
  }

  return decideGate(priceCredits, availableCredits);
}

/**
 * Obtains a hold on the class, reusing the learner's live one when it exists.
 *
 * This is the "book" half of book → gate → confirm, shared by both entry points
 * for one reason: `POST /classes/:id/bookings` refuses a second booking for the
 * same learner, so anything that calls it unconditionally turns an existing hold
 * into a spurious "you are already in this class" error. Reuse first, book only
 * when there is nothing to reuse.
 */
export async function obtainHold(
  item: Pick<ClassDetailView, 'id' | 'ownBooking'>,
  service: BookClassService,
): Promise<string> {
  const hold = item.ownBooking;
  if (hold !== null && hold.state === 'pending') {
    return hold.bookingId;
  }
  const result = await service.book(item.id, newIdempotencyKey());
  return result.booking.bookingId;
}

/** 1 credit = 1.000 VNĐ (integer VND only — no floats anywhere near money). */
export const VND_PER_CREDIT = 1_000;
/** SePay is paid in round thousands; a top-up is rounded up to a whole 10.000. */
export const TOP_UP_ROUNDING_VND = 10_000;

/**
 * The VNĐ amount that closes a shortfall, rounded up to a whole 10.000 VNĐ.
 *
 * Lives beside the gate because it is the gate's own arithmetic carried into
 * money: the shortfall the gate reported, converted to the smallest payable
 * amount that clears it. The checkout's button label, request body and success
 * copy all read this one number, so they cannot drift. A shortfall of 0 still
 * asks for the 10.000 minimum rather than 0, because a zero-amount intent is not
 * a payment.
 */
export function topUpAmountForShortfall(shortfallCredits: number): number {
  const raw = Math.max(0, shortfallCredits) * VND_PER_CREDIT;
  return Math.max(TOP_UP_ROUNDING_VND, Math.ceil(raw / TOP_UP_ROUNDING_VND) * TOP_UP_ROUNDING_VND);
}
