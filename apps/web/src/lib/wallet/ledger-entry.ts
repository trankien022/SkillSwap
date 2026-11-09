import type { WalletHistoryItemView } from '@skillswap/contracts';

/**
 * Presentation of one ledger entry (FR-010 / FR-021 wallet history).
 *
 * The wallet page used to label every row by direction alone — "Credits into your
 * wallet" / "Credits out of your wallet" — and print `reference` verbatim beneath
 * it. So a top-up, a teacher payout and a refund all read as the same event, and
 * the only distinguishing text on the row was an internal reference like
 * `booking_9f1e...` or a SePay provider ref: meaningless to the learner holding
 * the money, and the one part of the row they could not act on.
 *
 * `entry_type` already records what happened. This maps it to a sentence a learner
 * can read, and describes the reference rather than dumping it.
 */

/** What the entry represents, as a stable lowercase key for the message catalogue. */
export type LedgerEntryKind =
  | 'topUp'
  | 'topUpReversed'
  | 'classPayment'
  | 'classRefund'
  | 'teacherIncome'
  | 'platformFee'
  | 'unknown';

/**
 * `entry_type` values written by `wallet-ledger`
 * (`sql-wallet-repository.ts`): `top_up`, `reversal`, `learner_debit`,
 * `teacher_pending`, `platform_fee`, `release`, `refund`.
 */
const KIND_BY_TYPE: Readonly<Record<string, LedgerEntryKind>> = {
  top_up: 'topUp',
  reversal: 'topUpReversed',
  learner_debit: 'classPayment',
  refund: 'classRefund',
  release: 'teacherIncome',
  teacher_pending: 'teacherIncome',
  platform_fee: 'platformFee',
};

/**
 * True when the reference is an internal key the learner should not be shown.
 *
 * The API stores an intent id, booking id or provider reference here. None of
 * these is a receipt number the learner can look up; showing one implies a
 * traceability that does not exist on this screen.
 */
export function describeLedgerEntry(entry: Pick<WalletHistoryItemView, 'type'>): LedgerEntryKind {
  return KIND_BY_TYPE[entry.type] ?? 'unknown';
}

/**
 * True when the row should show its reference at all.
 *
 * A reference is only rendered for reversal/refund rows, where it identifies
 * *which* payment was returned and the learner may need to match it to their
 * bank statement.
 */
export function shouldShowReference(kind: LedgerEntryKind): boolean {
  return kind === 'topUpReversed' || kind === 'classRefund';
}
