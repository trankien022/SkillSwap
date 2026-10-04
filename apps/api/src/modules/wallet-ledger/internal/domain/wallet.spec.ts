import { DEFAULT_FEE_BPS, applyPlatformFee, canWithdraw } from './wallet';

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
