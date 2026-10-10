import type { WalletHistoryPage } from '@skillswap/contracts';

export const GET_WALLET_HISTORY = Symbol('GetWalletHistory');

export interface WalletHistoryRequest {
  ownerId: string;
  limit?: number;
  cursor?: string;
}

export interface GetWalletHistoryPort {
  execute(request: WalletHistoryRequest): Promise<WalletHistoryPage>;
}

export const DEFAULT_HISTORY_LIMIT = 20;
