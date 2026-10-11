import { createZodDto } from 'nestjs-zod';
import {
  topUpCallbackSchema,
  topUpIntentSchema,
  topUpRequestSchema,
  walletBalanceSchema,
  walletHistoryPageSchema,
  walletHistoryQuerySchema,
} from '@skillswap/contracts';

/** FR-008: start a wallet top-up. Body for POST /wallet/top-ups. */
export class TopUpRequestDto extends createZodDto(topUpRequestSchema) {}

/** FR-008: the pending top-up intent with a payment URL. */
export class TopUpIntentDto extends createZodDto(topUpIntentSchema) {}

/** FR-008 / ADR-017: payment provider callback. Body for POST /wallet/top-ups/callback. */
export class TopUpCallbackDto extends createZodDto(topUpCallbackSchema) {}

/** FR-008/FR-010: available and pending credits. */
export class WalletBalanceDto extends createZodDto(walletBalanceSchema) {}

/** FR-010: query params for GET /wallet/history. */
export class WalletHistoryQueryDto extends createZodDto(walletHistoryQuerySchema) {}

/** FR-010: a page of owner-scoped ledger entries. */
export class WalletHistoryPageDto extends createZodDto(walletHistoryPageSchema) {}
