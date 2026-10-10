import type { WalletHistoryPage } from '@skillswap/contracts';
import {
  DEFAULT_HISTORY_LIMIT,
  type GetWalletHistoryPort,
  type WalletHistoryRequest,
} from './port/in/get-wallet-history';
import type { WalletReader } from './port/out/wallet-reader';

/**
 * FR-010 (ADR-022): owner-scoped wallet history. The owner id always comes from
 * the trusted identity, so a caller can never read another user's ledger.
 */
export class GetWalletHistoryQueryHandler implements GetWalletHistoryPort {
  constructor(private readonly reader: WalletReader) {}

  async execute(request: WalletHistoryRequest): Promise<WalletHistoryPage> {
    return this.reader.history({
      ownerId: request.ownerId,
      limit: request.limit ?? DEFAULT_HISTORY_LIMIT,
      cursor: request.cursor,
    });
  }
}
