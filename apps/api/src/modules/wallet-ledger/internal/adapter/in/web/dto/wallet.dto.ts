import { createZodDto } from 'nestjs-zod';
import {
  sepayIpnSchema,
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

/** FR-008 / ADR-033: SePay Payment Gateway IPN. Body for POST /wallet/top-ups/callback. */
export class SepayIpnDto extends createZodDto(sepayIpnSchema) {}

/** FR-008/FR-010: available and pending credits. */
export class WalletBalanceDto extends createZodDto(walletBalanceSchema) {}

/** FR-010: query params for GET /wallet/history. */
export class WalletHistoryQueryDto extends createZodDto(walletHistoryQuerySchema) {}

/** FR-010: a page of owner-scoped ledger entries. */
export class WalletHistoryPageDto extends createZodDto(walletHistoryPageSchema) {}
