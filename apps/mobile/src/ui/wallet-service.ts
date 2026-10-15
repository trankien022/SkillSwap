import {
  topUpIntentCreatedSchema,
  topUpIntentStatusSchema,
  walletBalanceSchema,
  walletHistoryPageSchema,
  type TopUpIntentCreated,
  type TopUpIntentStatusView,
  type WalletBalanceView,
  type WalletHistoryPage,
} from '@skillswap/contracts';
import type { GatewayClient } from '@/infrastructure/http/gateway-client';

/**
 * FR-008: where SePay hands the payer back on mobile.
 *
 * The app's own scheme, so the OS returns the payer to the wallet screen rather
 * than to a web page the app cannot use. The API accepts this scheme
 * explicitly (see the wallet-ledger return-URL allow-list).
 */
export const MOBILE_WALLET_RETURN_URL = 'skillswap://wallet';

export class WalletValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletValidationError';
  }
}

/**
 * UI Service for Wallet balance, transaction ledger history, and top-up intents.
 * Strictly uses integer VND (1 credit = 1,000 VND; no floating-point amounts).
 */
export class WalletService {
  constructor(private readonly gateway: GatewayClient) {}

  async getBalance(): Promise<WalletBalanceView> {
    const raw = await this.gateway.authenticatedRequest<unknown>('/wallet/balance', {
      method: 'GET',
    });
    return walletBalanceSchema.parse(raw);
  }

  async getHistory(limit = 20, cursor?: string): Promise<WalletHistoryPage> {
    const params = new URLSearchParams();
    if (limit > 0) params.set('limit', String(limit));
    if (cursor) params.set('cursor', cursor);

    const queryString = params.toString();
    const path = `/wallet/history${queryString ? `?${queryString}` : ''}`;

    const raw = await this.gateway.authenticatedRequest<unknown>(path, {
      method: 'GET',
    });
    return walletHistoryPageSchema.parse(raw);
  }

  async initiateTopUp(amountVnd: number): Promise<TopUpIntentCreated> {
    if (!Number.isInteger(amountVnd) || amountVnd <= 0) {
      throw new WalletValidationError('Top-up amount must be a positive integer in VND');
    }

    if (amountVnd > 100_000_000) {
      throw new WalletValidationError('Top-up amount cannot exceed 100,000,000 VND');
    }

    const raw = await this.gateway.authenticatedRequest<unknown>('/wallet/top-ups', {
      method: 'POST',
      body: {
        amountVnd,
        // FR-008 / ADR-015: the OS hands the payer back to the app instead of
        // to a web page it cannot use. The API accepts this scheme explicitly;
        // the invoice number is not appended to it, so the wallet screen reads
        // its own pending intent after the hand-off.
        returnUrl: MOBILE_WALLET_RETURN_URL,
      },
    });

    return topUpIntentCreatedSchema.parse(raw);
  }

  /**
   * Reads the intent the payer was returned for, by invoice number.
   *
   * SePay's redirect carries the invoice number and nothing else, and the
   * intent id does not exist when the checkout form is submitted — so the app
   * looks the intent up by the same handle the provider uses.
   */
  async getTopUpIntentByProviderRef(providerRef: string): Promise<TopUpIntentStatusView> {
    const raw = await this.gateway.authenticatedRequest<unknown>(
      `/wallet/top-ups/by-provider-ref/${encodeURIComponent(providerRef)}`,
      { method: 'GET' },
    );
    return topUpIntentStatusSchema.parse(raw);
  }

  /**
   * Polls one intent (FR-008 / ADR-033). The response carries no checkout URL:
   * the IPN settles server-to-server, so this only answers "has it settled yet?".
   */
  async getTopUpIntent(intentId: string): Promise<TopUpIntentStatusView> {
    const raw = await this.gateway.authenticatedRequest<unknown>(
      `/wallet/top-ups/${encodeURIComponent(intentId)}`,
      { method: 'GET' },
    );
    return topUpIntentStatusSchema.parse(raw);
  }
}
