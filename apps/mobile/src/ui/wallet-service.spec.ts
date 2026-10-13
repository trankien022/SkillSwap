import type { GatewayClient } from '@/infrastructure/http/gateway-client';
import { WalletService, WalletValidationError } from './wallet-service';

describe('WalletService', () => {
  let mockGateway: jest.Mocked<Pick<GatewayClient, 'authenticatedRequest'>>;
  let service: WalletService;

  beforeEach(() => {
    mockGateway = {
      authenticatedRequest: jest.fn(),
    };
    service = new WalletService(mockGateway as unknown as GatewayClient);
  });

  describe('getBalance', () => {
    it('fetches and parses wallet balance view', async () => {
      mockGateway.authenticatedRequest.mockResolvedValueOnce({
        availableCredits: 150,
        pendingCredits: 90,
      });

      const result = await service.getBalance();

      expect(mockGateway.authenticatedRequest).toHaveBeenCalledWith('/wallet/balance', {
        method: 'GET',
      });
      expect(result).toEqual({
        availableCredits: 150,
        pendingCredits: 90,
      });
    });
  });

  describe('getHistory', () => {
    it('fetches ledger history with query limit and cursor', async () => {
      const mockPage = {
        items: [
          {
            id: 'tx-1',
            type: 'top_up',
            direction: 'credit',
            amountCredits: 100,
            status: 'completed',
            reference: 'ref-123',
            createdAt: '2026-10-12T00:00:00Z',
          },
        ],
        page: { limit: 15, nextCursor: 'cursor-2', total: 1 },
      };
      mockGateway.authenticatedRequest.mockResolvedValueOnce(mockPage);

      const result = await service.getHistory(15, 'cursor-1');

      expect(mockGateway.authenticatedRequest).toHaveBeenCalledWith(
        '/wallet/history?limit=15&cursor=cursor-1',
        { method: 'GET' },
      );
      expect(result).toEqual(mockPage);
    });
  });

  describe('initiateTopUp', () => {
    it('rejects non-integer VND amounts', async () => {
      await expect(service.initiateTopUp(100.5)).rejects.toThrow(WalletValidationError);
      await expect(service.initiateTopUp(0)).rejects.toThrow(WalletValidationError);
      await expect(service.initiateTopUp(-50000)).rejects.toThrow(WalletValidationError);
    });

    it('rejects amounts exceeding 100,000,000 VND', async () => {
      await expect(service.initiateTopUp(100_000_001)).rejects.toThrow(WalletValidationError);
    });

    it('submits valid integer top-up and returns the created intent', async () => {
      // Mirrors the real adapter's shape (provider `sepay`, hosted checkout URL)
      // so this test cannot pass against a URL SePay would never produce.
      const mockIntent = {
        id: '11111111-2222-4333-8444-555555555555',
        ownerId: 'user-1',
        provider: 'sepay',
        providerRef: 'SS-1-A1B2C3',
        amountVnd: 100000,
        amountCredits: 100,
        status: 'pending',
        paymentUrl: 'https://pay-sandbox.sepay.vn/v1/checkout?order_invoice_number=SS-1-A1B2C3',
      };
      mockGateway.authenticatedRequest.mockResolvedValueOnce(mockIntent);

      const result = await service.initiateTopUp(100000);

      expect(mockGateway.authenticatedRequest).toHaveBeenCalledWith('/wallet/top-ups', {
        method: 'POST',
        body: { amountVnd: 100000 },
      });
      expect(result).toEqual(mockIntent);
    });
  });

  describe('getTopUpIntent', () => {
    it('polls one intent and parses the settlement facts', async () => {
      const mockStatus = {
        id: '11111111-2222-4333-8444-555555555555',
        ownerId: 'user-1',
        provider: 'sepay',
        providerRef: 'SS-1-A1B2C3',
        amountVnd: 100000,
        amountCredits: 100,
        status: 'settled',
        paidAmountVnd: 100000,
        paidAt: '2026-10-14T02:30:00.000Z',
      };
      mockGateway.authenticatedRequest.mockResolvedValueOnce(mockStatus);

      const result = await service.getTopUpIntent('11111111-2222-4333-8444-555555555555');

      expect(mockGateway.authenticatedRequest).toHaveBeenCalledWith(
        '/wallet/top-ups/11111111-2222-4333-8444-555555555555',
        { method: 'GET' },
      );
      expect(result).toEqual(mockStatus);
    });

    it('encodes the id so a malformed value cannot break the path', async () => {
      mockGateway.authenticatedRequest.mockResolvedValueOnce({
        id: 'x',
        ownerId: 'user-1',
        provider: 'sepay',
        providerRef: 'SS-1-A1B2C3',
        amountVnd: 100000,
        amountCredits: 100,
        status: 'pending',
        paidAmountVnd: null,
        paidAt: null,
      });

      await service.getTopUpIntent('a/b');

      expect(mockGateway.authenticatedRequest).toHaveBeenCalledWith('/wallet/top-ups/a%2Fb', {
        method: 'GET',
      });
    });
  });
});
