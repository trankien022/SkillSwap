import { describe, expect, it } from 'vitest';
import { describeLedgerEntry, shouldShowReference } from './ledger-entry';

/**
 * The wallet page has to tell a learner *what happened to their money*, not just
 * which way it moved. These tests pin the mapping for every `entry_type` the
 * ledger actually writes, so a row can never fall back to a generic
 * "credits in / credits out" label without a test noticing.
 */

describe('describeLedgerEntry', () => {
  it.each([
    ['top_up', 'topUp'],
    ['reversal', 'topUpReversed'],
    ['learner_debit', 'classPayment'],
    ['refund', 'classRefund'],
    ['release', 'teacherIncome'],
    ['teacher_pending', 'teacherIncome'],
    ['platform_fee', 'platformFee'],
  ])('maps %s to %s', (type, kind) => {
    expect(describeLedgerEntry({ type })).toBe(kind);
  });

  it('falls back to unknown rather than inventing a meaning', () => {
    // A new entry_type must not silently render as a top-up.
    expect(describeLedgerEntry({ type: 'something_new' })).toBe('unknown');
  });
});

describe('shouldShowReference', () => {
  it('shows the reference only where it identifies a returned payment', () => {
    // A learner matching a reversal against a bank statement needs the ref.
    expect(shouldShowReference('topUpReversed')).toBe(true);
    expect(shouldShowReference('classRefund')).toBe(true);
  });

  it('hides it for ordinary movements, where it is an internal key', () => {
    for (const kind of ['topUp', 'classPayment', 'teacherIncome', 'platformFee', 'unknown'] as const) {
      expect(shouldShowReference(kind)).toBe(false);
    }
  });
});
