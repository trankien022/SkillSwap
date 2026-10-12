import type { MobileConfig } from '../config';
import { GatewayClient } from './gateway-client';
import { RatingGateway } from './rating-gateway';

describe('RatingGateway', () => {
  const config: MobileConfig = { gatewayBaseUrl: 'http://localhost:4000', apiBaseUrl: 'http://localhost:4000/api' };
  it('validates and submits a rating to the booking route', async () => {
    const rating = { id: 'r1', bookingId: 'b1', classId: 'c1', stars: 5, comment: 'Clear and useful', createdAt: '2026-10-20T11:00:00.000Z' };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 201, json: async () => rating });
    const client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({ getAccessToken: async () => 'access', refreshSession: async () => ({ tokens: { accessToken: 'next' } }) });
    await expect(new RatingGateway(client).submit('booking/1', { stars: 5, comment: 'Clear and useful' })).resolves.toEqual(rating);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/classes/bookings/booking%2F1/rating');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ stars: 5, comment: 'Clear and useful' });
  });
});
