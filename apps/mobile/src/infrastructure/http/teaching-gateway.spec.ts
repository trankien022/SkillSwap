import type { MobileConfig } from '../config';
import { GatewayClient } from './gateway-client';
import { TeachingGateway } from './teaching-gateway';

describe('TeachingGateway', () => {
  const config: MobileConfig = { gatewayBaseUrl: 'http://localhost:4000', apiBaseUrl: 'http://localhost:4000/api' };
  let fetchMock: jest.Mock;
  let gateway: TeachingGateway;
  beforeEach(() => {
    fetchMock = jest.fn();
    const client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({ getAccessToken: async () => 'access', refreshSession: async () => ({ tokens: { accessToken: 'next' } }) });
    gateway = new TeachingGateway(client);
  });
  const response = (data: unknown) => ({ ok: true, status: 200, json: async () => data });

  it('validates and creates a published class', async () => {
    const input = { skillIds: ['skill-1'], description: 'TypeScript basics', startsAt: '2026-10-20T10:00:00.000Z', durationMinutes: 60, priceCredits: 10, capacity: 1 };
    const view = { id: 'class-1', teacherId: 'teacher-1', state: 'published', startsAt: input.startsAt, durationMinutes: 60, priceCredits: 10, capacity: 1 };
    fetchMock.mockResolvedValueOnce(response(view));
    await expect(gateway.create(input)).resolves.toEqual(view);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/classes');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
    await expect(gateway.create({ ...input, priceCredits: 0 })).rejects.toThrow();
  });

  it('uses the documented lifecycle routes and PATCH contract', async () => {
    const updated = { id: 'class/1', teacherId: 'teacher-1', state: 'published', startsAt: '2026-10-21T10:00:00.000Z', durationMinutes: 60, priceCredits: 25, capacity: 3 };
    fetchMock.mockResolvedValueOnce(response(updated));
    fetchMock.mockResolvedValueOnce(response({ cancelled: true }));
    fetchMock.mockResolvedValueOnce(response({ started: true }));
    fetchMock.mockResolvedValueOnce(response({ completed: true }));
    await gateway.update('class/1', { description: 'Updated class', startsAt: updated.startsAt, priceCredits: 25, capacity: 3 });
    await gateway.cancel('class-1');
    await gateway.start('class-1');
    await gateway.complete('class-1');
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['http://localhost:4000/api/classes/class%2F1', 'PATCH'],
      ['http://localhost:4000/api/classes/class-1/cancel', 'POST'],
      ['http://localhost:4000/api/classes/class-1/start', 'POST'],
      ['http://localhost:4000/api/classes/class-1/complete', 'POST'],
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ description: 'Updated class', startsAt: updated.startsAt, priceCredits: 25, capacity: 3 });
  });
});
