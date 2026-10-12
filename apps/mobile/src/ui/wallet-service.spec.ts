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

    it('submits valid integer top-up and returns intent view', async () => {
      const mockIntent = {
        id: 'topup-1',
        ownerId: 'user-1',
        provider: 'mock',
        providerRef: 'ref-abc',
        amountVnd: 100000,
        amountCredits: 100,
        status: 'pending',
        paymentUrl: 'https://payment.skillswap.edu.vn/mock/checkout/topup-1',
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
});
