import type { MobileConfig } from '../infrastructure/config';
import { GatewayClient } from '../infrastructure/http/gateway-client';
import { TeachingGateway } from '../infrastructure/http/teaching-gateway';

describe('MyBookings no-show action integration', () => {
  const config: MobileConfig = {
    gatewayBaseUrl: 'http://localhost:4000',
    apiBaseUrl: 'http://localhost:4000/api',
  };
  let fetchMock: jest.Mock;
  let client: GatewayClient;
  let teachingGateway: TeachingGateway;

  beforeEach(() => {
    fetchMock = jest.fn();
    client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({
      getAccessToken: async () => 'test-token',
      refreshSession: async () => ({ tokens: { accessToken: 'next-token' } }),
    });
    teachingGateway = new TeachingGateway(client);
  });

  it('successfully cancels booking and signals refund when server returns cancelled: true', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ cancelled: true }),
    });

    const result = await teachingGateway.reportTeacherNoShow('bk-123');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/classes/bookings/bk-123/no-show');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(result.cancelled).toBe(true);
  });

  it('returns cancelled: false as an informative refusal when window is not met', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ cancelled: false }),
    });

    const result = await teachingGateway.reportTeacherNoShow('bk-123');

    expect(result.cancelled).toBe(false);
  });
});
