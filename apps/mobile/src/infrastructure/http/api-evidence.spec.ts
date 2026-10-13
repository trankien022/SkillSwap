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
