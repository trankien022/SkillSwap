import type { MobileConfig } from '../config';
import { GatewayClient } from './gateway-client';
import { RoomAccessGateway } from './room-access-gateway';

describe('RoomAccessGateway', () => {
  const config: MobileConfig = { gatewayBaseUrl: 'http://localhost:4000', apiBaseUrl: 'http://localhost:4000/api' };
  it('requests and validates authorized room access', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ room: 'class-1', token: 'short-lived', expiresAt: '2026-10-20T11:00:00.000Z', url: 'https://meet.example.test/class-1' }) });
    const client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({ getAccessToken: async () => 'access', refreshSession: async () => ({ tokens: { accessToken: 'next' } }) });
    await expect(new RoomAccessGateway(client).request('booking/1', 'Learner')).resolves.toMatchObject({ room: 'class-1' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/classes/bookings/booking%2F1/room-access');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ displayName: 'Learner' });
  });
});
