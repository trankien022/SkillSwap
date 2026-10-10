import type { WalletHistoryItemView, WalletHistoryPage } from '@skillswap/contracts';

export const WALLET_READER = Symbol('WalletReader');

export interface HistoryQuery {
  ownerId: string;
  limit: number;
  /** Opaque cursor from a previous page (`createdAt|id`). */
  cursor?: string;
}

/** Read-only view of a wallet's ledger, owner-scoped (FR-010 / ADR-022). */
export interface WalletReader {
  /** Paginated ledger history for one owner, newest first. */
  history(query: HistoryQuery): Promise<WalletHistoryPage>;
  /** Sum of credits and debits for one owner, for reconciliation. */
  sums(ownerId: string): Promise<{ credits: number; debits: number }>;
}

export type { WalletHistoryItemView };
