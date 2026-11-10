import type { MobileConfig } from '../config';
import { GatewayClient } from './gateway-client';
import { NotificationGateway } from './notification-gateway';

describe('NotificationGateway', () => {
  const config: MobileConfig = { gatewayBaseUrl: 'http://localhost:4000', apiBaseUrl: 'http://localhost:4000/api/v1' };
  it('calls inbox and device subscription routes with contract-checked payloads', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, code: 'OK', message: 'OK', data: { items: [], nextCursor: null, unreadCount: 0 }, errors: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, code: 'OK', message: 'OK', data: { id: 'dev1', installationId: 'install1', platform: 'ios', isActive: true, createdAt: '2026-10-20T10:00:00.000Z' }, errors: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => { throw new Error('no body'); } });
    const client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({ getAccessToken: async () => 'access', refreshSession: async () => ({ tokens: { accessToken: 'next' } }) });
    const gateway = new NotificationGateway(client);
    await expect(gateway.list({ unreadOnly: true, limit: 10 })).resolves.toMatchObject({ unreadCount: 0 });
    await gateway.registerDevice({ token: 'ExponentPushToken[test]', platform: 'ios', installationId: 'install1' });
    await gateway.removeDevice('dev/1');
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['http://localhost:4000/api/v1/notifications?unreadOnly=true&limit=10', 'GET'],
      ['http://localhost:4000/api/v1/notification-devices', 'POST'],
      ['http://localhost:4000/api/v1/notification-devices/dev%2F1', 'DELETE'],
    ]);
  });

  it('marks one notification read and parses the unread count from the server', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, code: 'OK', message: 'OK', data: { success: true, unreadCount: 2 }, errors: [] }) });
    const client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({ getAccessToken: async () => 'access', refreshSession: async () => ({ tokens: { accessToken: 'next' } }) });
    await expect(new NotificationGateway(client).markRead('n/1')).resolves.toEqual({ success: true, unreadCount: 2 });
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/v1/notifications/n%2F1/read');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('marks the whole inbox read and parses the unread count from the server', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, code: 'OK', message: 'OK', data: { success: true, unreadCount: 0 }, errors: [] }) });
    const client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({ getAccessToken: async () => 'access', refreshSession: async () => ({ tokens: { accessToken: 'next' } }) });
    await expect(new NotificationGateway(client).markAllRead()).resolves.toEqual({ success: true, unreadCount: 0 });
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/v1/notifications/read-all');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('rejects a mark-read response that breaks the contract', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, code: 'OK', message: 'OK', data: { success: true }, errors: [] }) });
    const client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({ getAccessToken: async () => 'access', refreshSession: async () => ({ tokens: { accessToken: 'next' } }) });
    await expect(new NotificationGateway(client).markAllRead()).rejects.toThrow();
  });

  it('treats a 204 device deletion as complete without parsing a body', async () => {
    const body = jest.fn();
    const fetchMock = jest.fn().mockResolvedValueOnce({ ok: true, status: 204, json: body });
    const client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({ getAccessToken: async () => 'access', refreshSession: async () => ({ tokens: { accessToken: 'next' } }) });
    const gateway = new NotificationGateway(client);
    await expect(gateway.removeDevice('dev1')).resolves.toBeUndefined();
    expect(body).not.toHaveBeenCalled();
  });
});


describe('notification read commands', () => {
  it('uses encoded owner-scoped routes and the exact server count', async () => {
    const request = jest.fn().mockResolvedValueOnce({ success: true, unreadCount: 24 }).mockResolvedValueOnce({ success: true, unreadCount: 0 });
    const gateway = new NotificationGateway({ authenticatedRequest: request } as unknown as GatewayClient);
    await expect(gateway.markRead('a/b')).resolves.toEqual({ success: true, unreadCount: 24 });
    await expect(gateway.markAllRead()).resolves.toEqual({ success: true, unreadCount: 0 });
    expect(request.mock.calls).toEqual([
      ['/notifications/a%2Fb/read', { method: 'POST' }],
      ['/notifications/read-all', { method: 'POST' }],
    ]);
  });
  it('rejects an invalid count instead of guessing', async () => {
    const request = jest.fn().mockResolvedValue({ success: true, unreadCount: -1 });
    const gateway = new NotificationGateway({ authenticatedRequest: request } as unknown as GatewayClient);
    await expect(gateway.markAllRead()).rejects.toThrow();
  });
});
