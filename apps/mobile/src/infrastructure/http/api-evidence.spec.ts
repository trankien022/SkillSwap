import { evidenceFetch, evidenceRoute } from './api-evidence';

describe('mobile API evidence', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_EVIDENCE;
    jest.restoreAllMocks();
  });
  it('removes query strings and identifiers, and rejects arbitrary routes', () => {
    expect(evidenceRoute('http://gateway/api/classes/secret-id?token=secret')).toBe(
      '/api/classes/:id',
    );
    expect(evidenceRoute('http://gateway/api/unknown/secret')).toBeNull();
    expect(evidenceRoute('http://gateway/api/classes/bookings/me')).toBe(
      '/api/classes/bookings/me',
    );
  });
  it('templates the top-up poll route but keeps the server-to-server callback out', () => {
    // FR-008 / ADR-033: the poll is a real client call, so it is evidence.
    expect(
      evidenceRoute('http://gateway/api/wallet/top-ups/11111111-2222-4333-8444-555555555555'),
    ).toBe('/api/wallet/top-ups/:id');
    // The callback is posted by SePay, never by this client. It must not match
    // the `:id` template above, which would record a server-to-server call as
    // client evidence; it is simply not client evidence at all.
    expect(evidenceRoute('http://gateway/api/wallet/top-ups/callback')).toBeNull();
  });
  it('templates the invoice-number lookup separately from the id lookup', () => {
    // FR-008: the return path reads the intent by invoice number, which is a
    // different route from the id poll — `by-provider-ref` is a literal
    // segment, not an id.
    expect(
      evidenceRoute('http://gateway/api/wallet/top-ups/by-provider-ref/SS-1-A1B2C3'),
    ).toBe('/api/wallet/top-ups/by-provider-ref/:providerRef');
  });
  it('records every endpoint the mobile gateways call', () => {
    // Pins the client-side route allow-list to the map in
    // `docs/api/FRONTEND-API-MAP.md`. A gateway that starts calling a new route
    // fails here until the route is both documented and allow-listed.
    const called = new Map<string, string>([
      ['http://gateway/api/auth/register', '/api/auth/register'],
      ['http://gateway/api/auth/login', '/api/auth/login'],
      ['http://gateway/api/auth/refresh', '/api/auth/refresh'],
      ['http://gateway/api/auth/logout', '/api/auth/logout'],
      ['http://gateway/api/auth/me', '/api/auth/me'],
      ['http://gateway/api/classes', '/api/classes'],
      ['http://gateway/api/classes/c-1', '/api/classes/:id'],
      ['http://gateway/api/classes/c-1/bookings', '/api/classes/:id/bookings'],
      ['http://gateway/api/classes/c-1/cancel', '/api/classes/c-1/cancel'],
      ['http://gateway/api/classes/c-1/start', '/api/classes/c-1/start'],
      ['http://gateway/api/classes/c-1/complete', '/api/classes/c-1/complete'],
      ['http://gateway/api/classes/bookings/me', '/api/classes/bookings/me'],
      ['http://gateway/api/classes/bookings/b-1/confirm', '/api/classes/bookings/:bookingId/confirm'],
      ['http://gateway/api/classes/bookings/b-1/rating', '/api/classes/bookings/:bookingId/rating'],
      ['http://gateway/api/classes/bookings/b-1/room-access', '/api/classes/bookings/:bookingId/room-access'],
      ['http://gateway/api/classes/bookings/b-1/no-show', '/api/classes/bookings/:bookingId/no-show'],
      ['http://gateway/api/skills', '/api/skills'],
      ['http://gateway/api/skill-evidence', '/api/skill-evidence'],
      ['http://gateway/api/skill-evidence/e-1/history', '/api/skill-evidence/:id/history'],
      ['http://gateway/api/skill-evidence/e-1/claim', '/api/skill-evidence/e-1/claim'],
      ['http://gateway/api/skill-evidence/e-1/decision', '/api/skill-evidence/e-1/decision'],
      ['http://gateway/api/profile-skills/me', '/api/profile-skills/me'],
      ['http://gateway/api/verifiers/me/queue', '/api/verifiers/me/queue'],
      ['http://gateway/api/student-verifications', '/api/student-verifications'],
      ['http://gateway/api/student-verifications/documents', '/api/student-verifications/documents'],
      ['http://gateway/api/student-verifications/me', '/api/student-verifications/me'],
      ['http://gateway/api/wallet/balance', '/api/wallet/balance'],
      ['http://gateway/api/wallet/history', '/api/wallet/history'],
      ['http://gateway/api/wallet/top-ups', '/api/wallet/top-ups'],
      ['http://gateway/api/wallet/top-ups/i-1', '/api/wallet/top-ups/:id'],
      ['http://gateway/api/wallet/top-ups/by-provider-ref/SS-1', '/api/wallet/top-ups/by-provider-ref/:providerRef'],
      ['http://gateway/api/notifications', '/api/notifications'],
      ['http://gateway/api/notification-devices', '/api/notification-devices'],
      ['http://gateway/api/notification-devices/d-1', '/api/notification-devices/:id'],
    ]);

    for (const [url, template] of called) {
      expect([url, evidenceRoute(url)]).toEqual([url, template]);
    }
  });
  it('keeps booking actions out of the class templates', () => {
    // `/classes/bookings/...` must never be templated as `/api/classes/:id/...`;
    // the booking id would be recorded as a class id.
    for (const action of ['confirm', 'rating', 'room-access', 'no-show']) {
      expect(evidenceRoute(`http://gateway/api/classes/bookings/b-9/${action}`)).not.toMatch(
        /^\/api\/classes\/:id/,
      );
    }
  });
  it('logs no credentials, request body, response payload, or query values', async () => {
    process.env.EXPO_PUBLIC_API_EVIDENCE = '1';
    const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const response = { status: 200 } as Response;
    const fetchImpl = jest.fn().mockResolvedValue(response);
    expect(
      await evidenceFetch(fetchImpl, 'http://gateway/api/auth/login?secret=abc', {
        method: 'POST',
        headers: { Authorization: 'Bearer private-token' },
        body: 'password=private-password',
      }),
    ).toBe(response);
    const recorded = JSON.stringify(log.mock.calls);
    expect(recorded).not.toMatch(/private-token|private-password|abc|Authorization/);
    expect(recorded).toContain('/api/auth/login');
  });
  it('preserves network failures while recording status zero', async () => {
    process.env.EXPO_PUBLIC_API_EVIDENCE = '1';
    const log = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = new Error('private network details');
    await expect(
      evidenceFetch(jest.fn().mockRejectedValue(error), 'http://gateway/api/skills', {}),
    ).rejects.toBe(error);
    expect(JSON.parse(log.mock.calls[0][1] as string).status).toBe(0);
    expect(JSON.stringify(log.mock.calls)).not.toContain(error.message);
  });
});
