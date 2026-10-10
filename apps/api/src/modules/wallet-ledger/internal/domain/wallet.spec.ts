import {
  assertCanSpend,
  canAdvanceTopUp,
  DEFAULT_FEE_BPS,
  applyPlatformFee,
  canWithdraw,
  InsufficientBalanceError,
  InvalidTopUpAmountError,
  isTopUpStatus,
  splitSettlement,
  topUpStatusRank,
  vndToCredits,
} from './wallet';

describe('wallet credit math', () => {
  it('splits the default 10% platform fee with no rounding drift', () => {
    expect(DEFAULT_FEE_BPS).toBe(1000);
    expect(applyPlatformFee(1000)).toEqual({ platformFeeCredits: 100, teacherCredits: 900 });
    expect(applyPlatformFee(999)).toEqual({ platformFeeCredits: 99, teacherCredits: 900 });
    expect(applyPlatformFee(1)).toEqual({ platformFeeCredits: 0, teacherCredits: 1 });
  });

  it('supports fee-free transfers', () => {
    expect(applyPlatformFee(500, 0)).toEqual({ platformFeeCredits: 0, teacherCredits: 500 });
  });

  it('rejects non-integer or non-positive amounts', () => {
    expect(() => applyPlatformFee(0)).toThrow(RangeError);
    expect(() => applyPlatformFee(-5)).toThrow(RangeError);
    expect(() => applyPlatformFee(1.5)).toThrow(RangeError);
    expect(() => applyPlatformFee(100, -1)).toThrow(RangeError);
    expect(() => applyPlatformFee(100, 10_001)).toThrow(RangeError);
  });

  it('allows withdrawals only from an active wallet', () => {
    expect(canWithdraw('active')).toBe(true);
    expect(canWithdraw('frozen')).toBe(false);
    expect(canWithdraw('closed')).toBe(false);
  });
});

describe('top-up domain (FR-008 / ADR-017)', () => {
  it('converts whole VND to credits at the fixed rate and rejects the rest', () => {
    expect(vndToCredits(1000)).toBe(1);
    expect(vndToCredits(100_000)).toBe(100);
    expect(() => vndToCredits(1500)).toThrow(InvalidTopUpAmountError);
    expect(() => vndToCredits(0)).toThrow(InvalidTopUpAmountError);
    expect(() => vndToCredits(-1000)).toThrow(InvalidTopUpAmountError);
  });

  it('ranks statuses monotonically so older callbacks cannot regress state', () => {
    expect(isTopUpStatus('settled')).toBe(true);
    expect(isTopUpStatus('nope')).toBe(false);
    expect(topUpStatusRank('pending')).toBeLessThan(topUpStatusRank('settled'));
    expect(topUpStatusRank('settled')).toBeLessThan(topUpStatusRank('reversed'));
    // Equal rank (settled vs failed) is a no-op replay, never an advance.
    expect(canAdvanceTopUp('pending', 'settled')).toBe(true);
    expect(canAdvanceTopUp('settled', 'failed')).toBe(false);
    expect(canAdvanceTopUp('reversed', 'settled')).toBe(false);
  });

  it('blocks spending while the wallet is in deficit', () => {
    expect(() => assertCanSpend(100, 100)).not.toThrow();
    expect(() => assertCanSpend(100, 101)).toThrow(InsufficientBalanceError);
    expect(() => assertCanSpend(-10, 1)).toThrow(InsufficientBalanceError);
  });
});

describe('settlement split (FR-009 / ADR-018)', () => {
  it('floors the fee and gives the remainder to the teacher', () => {
    expect(splitSettlement(100)).toEqual({ platformFeeCredits: 10, teacherCredits: 90 });
    expect(splitSettlement(101)).toEqual({ platformFeeCredits: 10, teacherCredits: 91 });
    expect(splitSettlement(1)).toEqual({ platformFeeCredits: 0, teacherCredits: 1 });
    expect(splitSettlement(999)).toEqual({ platformFeeCredits: 99, teacherCredits: 900 });
  });

  it('keeps the integer invariant teacher + fee == price', () => {
    for (const price of [1, 3, 7, 99, 100, 101, 12345, 999_999]) {
      const { teacherCredits, platformFeeCredits } = splitSettlement(price);
      expect(teacherCredits + platformFeeCredits).toBe(price);
      expect(Number.isInteger(teacherCredits)).toBe(true);
      expect(Number.isInteger(platformFeeCredits)).toBe(true);
    }
  });

  it('rejects non-positive or non-integer prices', () => {
    expect(() => splitSettlement(0)).toThrow(RangeError);
    expect(() => splitSettlement(-5)).toThrow(RangeError);
    expect(() => splitSettlement(1.5)).toThrow(RangeError);
  });
});
