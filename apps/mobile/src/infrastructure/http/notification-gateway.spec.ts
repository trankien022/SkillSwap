import type { MobileConfig } from '../config';
import { GatewayClient } from './gateway-client';
import { NotificationGateway } from './notification-gateway';

describe('NotificationGateway', () => {
  const config: MobileConfig = { gatewayBaseUrl: 'http://localhost:4000', apiBaseUrl: 'http://localhost:4000/api' };
  it('calls inbox and device subscription routes with contract-checked payloads', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, code: 'OK', message: 'OK', data: { items: [], nextCursor: null, unreadCount: 0 }, errors: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, code: 'OK', message: 'OK', data: { id: 'dev1', installationId: 'install1', platform: 'ios', isActive: true, createdAt: '2026-10-20T10:00:00.000Z' }, errors: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, code: 'OK', message: 'OK', data: { success: true }, errors: [] }) });
    const client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({ getAccessToken: async () => 'access', refreshSession: async () => ({ tokens: { accessToken: 'next' } }) });
    const gateway = new NotificationGateway(client);
    await expect(gateway.list({ unreadOnly: true, limit: 10 })).resolves.toMatchObject({ unreadCount: 0 });
    await gateway.registerDevice({ token: 'ExponentPushToken[test]', platform: 'ios', installationId: 'install1' });
    await gateway.removeDevice('dev/1');
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['http://localhost:4000/api/notifications?unreadOnly=true&limit=10', 'GET'],
      ['http://localhost:4000/api/notification-devices', 'POST'],
      ['http://localhost:4000/api/notification-devices/dev%2F1', 'DELETE'],
    ]);
  });
});
