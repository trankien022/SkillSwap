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
    const updated = { id: 'class/1', teacherId: 'teacher-1', state: 'published', startsAt: '2026-10-20T10:00:00.000Z', durationMinutes: 60, priceCredits: 11, capacity: 1 };
    fetchMock.mockResolvedValueOnce(response(updated));
    fetchMock.mockResolvedValueOnce(response({ cancelled: true }));
    fetchMock.mockResolvedValueOnce(response({ started: true }));
    fetchMock.mockResolvedValueOnce(response({ completed: true }));
    await gateway.update('class/1', { priceCredits: 11 });
    await gateway.cancel('class-1');
    await gateway.start('class-1');
    await gateway.complete('class-1');
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['http://localhost:4000/api/classes/class%2F1', 'PATCH'],
      ['http://localhost:4000/api/classes/class-1/cancel', 'POST'],
      ['http://localhost:4000/api/classes/class-1/start', 'POST'],
      ['http://localhost:4000/api/classes/class-1/complete', 'POST'],
    ]);
  });

  it('declares a teacher no-show against the booking resource, not the class', async () => {
    fetchMock.mockResolvedValueOnce(response({ cancelled: true }));

    const result = await gateway.reportTeacherNoShow('booking/9');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:4000/api/classes/bookings/booking%2F9/no-show',
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(result).toEqual({ cancelled: true });
  });

  it('treats cancelled:false as a refusal, not a failure', async () => {
    // The 15-minute window has not closed yet. The server answers 200 with
    // cancelled:false; that is a legitimate "not yet", not an error.
    fetchMock.mockResolvedValueOnce(response({ cancelled: false }));

    await expect(gateway.reportTeacherNoShow('booking-1')).resolves.toEqual({
      cancelled: false,
    });
  });

  it('surfaces the server message when the request is rejected outright', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        success: false,
        code: 'ForbiddenError',
        message: 'Only an administrator may cancel a booking',
        data: null,
        errors: [],
      }),
    });

    await expect(gateway.reportTeacherNoShow('booking-1')).rejects.toThrow(
      'Only an administrator may cancel a booking',
    );
  });

  it('never auto-replays a no-show on 401, because a POST may already have landed', async () => {
    // Replaying a mutation is how one no-show becomes two. The client refuses to
    // guess and demands reconciliation instead.
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        code: 'UNAUTHORIZED',
        message: 'Missing bearer token',
        data: null,
        errors: [],
      }),
    });

    await expect(gateway.reportTeacherNoShow('booking-1')).rejects.toThrow(
      /Automatic replay suppressed/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
