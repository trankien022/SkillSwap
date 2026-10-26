import type { TopUpStatus } from '../../../domain/wallet';

export const TOP_UP_INTENT_REPOSITORY = Symbol('TopUpIntentRepository');

export interface TopUpIntent {
  readonly id: string;
  readonly ownerId: string;
  readonly provider: string;
  readonly providerRef: string;
  /** FR-008 / ADR-033: the provider's own order id (SePay `order_id`), if reported. */
  readonly providerOrderId: string | null;
  readonly amountVnd: number;
  readonly amountCredits: number;
  /** BR-027 / D3: the rate this intent was priced at, snapshotted when it was created. */
  readonly vndPerCredit: number;
  /** FR-008 / ADR-033: the amount the provider actually captured, if settled. */
  readonly paidAmountVnd: number | null;
  readonly paidAt: Date | null;
  readonly status: TopUpStatus;
}

export interface NewTopUpIntent {
  readonly ownerId: string;
  readonly provider: string;
  readonly providerRef: string;
  readonly amountVnd: number;
  readonly amountCredits: number;
  /**
   * BR-027 / decision D3: the rate this intent was priced at, stored on the row.
   *
   * A snapshot, not a lookup: if the configured rate changes after a payer has opened a
   * checkout, the intent must still mean what it said when it was created.
   */
  readonly vndPerCredit: number;
}

/** FR-008 / ADR-033: settlement facts a verified IPN contributes to the intent. */
export interface TopUpSettlement {
  readonly providerOrderId: string | null;
  readonly paidAmountVnd: number | null;
  readonly paidAt: Date | null;
}

export interface TopUpIntentRepository {
  create(input: NewTopUpIntent): Promise<TopUpIntent>;
  findByProviderRef(provider: string, providerRef: string): Promise<TopUpIntent | null>;
  findById(id: string): Promise<TopUpIntent | null>;
  updateStatus(id: string, status: TopUpStatus): Promise<void>;
  /**
   * Records settlement facts alongside the status transition. Called only when
   * a callback is applied, so a replay cannot overwrite the original capture.
   */
  recordSettlement(id: string, status: TopUpStatus, settlement: TopUpSettlement): Promise<void>;
  /**
   * FR-008 / ADR-033 reconciliation: intents still awaiting a callback that are
   * older than `olderThanMs`, oldest first. A live checkout is left alone
   * because its age is below the threshold.
   */
  findStalePending(olderThanMs: number, limit: number): Promise<TopUpIntent[]>;
}
