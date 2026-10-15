import { describe, expect, it, vi } from 'vitest';
import { checkBalanceGate, decideGate, topUpAmountForShortfall, VND_PER_CREDIT } from './gate';

/**
 * The balance gate is the single decision both booking entry points run, so its
 * verdicts are pinned here: affordable, short (with the exact shortfall), and
 * unreadable. The last one matters most — an unreadable balance must never be
 * treated as affordable, because the next step would be a debit the learner may
 * not be able to pay.
 */
describe('decideGate', () => {
  it('is sufficient, with no shortfall, when the balance covers the price', () => {
    expect(decideGate(120, 1_000)).toEqual({
      decision: 'sufficient',
      availableCredits: 1_000,
      priceCredits: 120,
      shortfall: 0,
    });
  });

  it('is sufficient at exactly the price — no off-by-one at the boundary', () => {
    expect(decideGate(120, 120).decision).toBe('sufficient');
  });

  it('is short, stating the exact shortfall, when one credit is missing', () => {
    expect(decideGate(120, 119)).toEqual({
      decision: 'short',
      availableCredits: 119,
      priceCredits: 120,
      shortfall: 1,
    });
  });

  it('is short with the whole price when the balance is zero', () => {
    const gate = decideGate(260, 0);
    expect(gate.decision).toBe('short');
    expect(gate.decision === 'short' ? gate.shortfall : -1).toBe(260);
  });

  it('never reports a negative shortfall', () => {
    for (const [price, credits] of [
      [120, 1_000],
      [0, 0],
      [90, 90],
    ]) {
      const gate = decideGate(price, credits);
      expect(gate.decision === 'short' ? gate.shortfall : 0).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('checkBalanceGate', () => {
  it('reads the balance through the injected reader and decides from it', async () => {
    const read = vi.fn().mockResolvedValue(50);
    const gate = await checkBalanceGate(130, read);

    expect(read).toHaveBeenCalledTimes(1);
    expect(gate).toEqual({
      decision: 'short',
      availableCredits: 50,
      priceCredits: 130,
      shortfall: 80,
    });
  });

  it('treats an unreadable balance as unaffordable, never as sufficient', async () => {
    const read = vi.fn().mockRejectedValue(new Error('wallet down'));
    const gate = await checkBalanceGate(130, read);

    expect(gate).toEqual({ decision: 'unreadable', priceCredits: 130 });
    expect(gate.decision).not.toBe('sufficient');
  });

  it('does not swallow the price when the reader fails', async () => {
    const gate = await checkBalanceGate(999, vi.fn().mockRejectedValue(new Error('nope')));
    expect(gate.priceCredits).toBe(999);
  });
});

/**
 * The checkout exists to close a specific shortfall, so the amount it asks SePay
 * for must be derived from that shortfall — not a fixed 100.000 VNĐ that over-
 * or under-shoots depending on the class price. Money is integer VNĐ everywhere
 * (1 credit = 1.000 VNĐ), rounded upward only: asking for less than the learner
 * owes would leave them on the same page with the same problem.
 */
describe('topUpAmountForShortfall', () => {
  it('asks for exactly the shortfall when it is already a whole 10.000 VNĐ', () => {
    expect(topUpAmountForShortfall(120)).toBe(120_000);
  });

  it('rounds up to the next whole 10.000 VNĐ, never down', () => {
    expect(topUpAmountForShortfall(121)).toBe(130_000);
    expect(topUpAmountForShortfall(1)).toBe(10_000);
    expect(topUpAmountForShortfall(9)).toBe(10_000);
    expect(topUpAmountForShortfall(11)).toBe(20_000);
  });

  it('never returns zero or a negative amount, even with no shortfall', () => {
    expect(topUpAmountForShortfall(0)).toBe(10_000);
    expect(topUpAmountForShortfall(-50)).toBe(10_000);
  });

  it('always returns an integer number of VNĐ', () => {
    for (const shortfall of [1, 7, 99, 120, 1_337]) {
      expect(Number.isInteger(topUpAmountForShortfall(shortfall))).toBe(true);
    }
  });

  it('covers the shortfall it was computed from', () => {
    for (const shortfall of [1, 10, 11, 121, 999]) {
      expect(topUpAmountForShortfall(shortfall) / VND_PER_CREDIT).toBeGreaterThanOrEqual(shortfall);
    }
  });
});
