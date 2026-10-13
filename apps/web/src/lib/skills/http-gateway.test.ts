import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Tests for the S10 skills gateway (FR-003 / FR-018).
 *
 * The screen is new on Web, so these pin the two properties that matter most:
 * every call goes to an endpoint that really exists, and a rejection is
 * propagated rather than being reported as success.
 */

/** A success envelope (`unwrapEnvelope` reads `data`). */
function envelope(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * A failure envelope. The API's `domain-error.filter` emits `{ success: false,
 * code, message, errors }` flat — *not* wrapped in `data` — so the helper must
 * match that shape, or the test would "pass" while the gateway read a field the
 * server never sends.
 */
function errorEnvelope(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, code: 'ERR', message, errors: [] }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * A fresh module graph per test, so `getTokens` sees the same token store the
 * gateway reads. `vi.resetModules` keeps the mocked api-client from leaking
 * between cases.
 */
async function gatewayWith(tokens: object | null) {
  vi.resetModules();
  vi.doMock('../api-client', () => ({
    callApi: (...args: unknown[]) => mockCallApi(...args),
    getTokens: () => tokens,
    unwrapEnvelope: async (res: Response) => {
      const body = (await res.json()) as { data: unknown };
      return body.data;
    },
  }));
  const mod = await import('./http-gateway');
  return mod;
}

let mockCallApi: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockCallApi = vi.fn();
});

afterEach(() => {
  vi.doUnmock('../api-client');
  vi.resetModules();
});

describe('HttpSkillsGateway', () => {
  it('refuses to treat a signed-out caller as authenticated', async () => {
    const mod = await gatewayWith(null);
    expect(new mod.HttpSkillsGateway().isAuthenticated()).toBe(false);
  });

  it('reports an authenticated caller', async () => {
    const mod = await gatewayWith({ accessToken: 'a', refreshToken: 'r' });
    expect(new mod.HttpSkillsGateway().isAuthenticated()).toBe(true);
  });

  it('reads the catalogue from GET /skills', async () => {
    mockCallApi = vi.fn(async () =>
      envelope({ items: [{ id: 'skill-1', name: 'Chess', category: 'Games', levels: [] }], nextCursor: null }),
    );
    const mod = await gatewayWith({ accessToken: 'a', refreshToken: 'r' });

    const items = await new mod.HttpSkillsGateway().getCatalogue();

    expect(mockCallApi).toHaveBeenCalledWith('/skills?limit=100');
    expect(items).toEqual([{ id: 'skill-1', name: 'Chess', category: 'Games', levels: [] }]);
  });

  it('reads the caller own profile skills and keeps pending levels', async () => {
    mockCallApi = vi.fn(async () =>
      envelope({
        items: [
          { id: 'ps-1', skillId: 'skill-1', skillName: 'Chess', category: 'Games', approvedLevel: null },
          { id: 'ps-2', skillId: 'skill-2', skillName: 'Go', category: 'Games', approvedLevel: 'advanced' },
        ],
        page: null,
      }),
    );
    const mod = await gatewayWith({ accessToken: 'a', refreshToken: 'r' });

    const items = await new mod.HttpSkillsGateway().getMyProfileSkills();

    expect(mockCallApi).toHaveBeenCalledWith('/profile-skills/me');
    expect(items).toHaveLength(2);
    expect(items[0].approvedLevel).toBeNull();
    expect(items[1].approvedLevel).toBe('advanced');
  });

  it('throws SkillsAuthError on a 401 rather than returning an empty list', async () => {
    mockCallApi = vi.fn(async () => errorEnvelope('unauthorized', 401));
    const mod = await gatewayWith({ accessToken: 'a', refreshToken: 'r' });

    await expect(new mod.HttpSkillsGateway().getCatalogue()).rejects.toBeInstanceOf(mod.SkillsAuthError);
  });

  it('surfaces the API error message on a non-401 failure', async () => {
    mockCallApi = vi.fn(async () => errorEnvelope('Catalogue unavailable', 503));
    const mod = await gatewayWith({ accessToken: 'a', refreshToken: 'r' });

    await expect(new mod.HttpSkillsGateway().getCatalogue()).rejects.toThrow('Catalogue unavailable');
  });

  it('posts evidence with the contract shape only', async () => {
    mockCallApi = vi.fn(async () =>
      envelope({
        id: 'ev-1',
        profileSkillId: 'ps-1',
        skillId: 'skill-1',
        skillName: 'Chess',
        category: 'Games',
        ownerId: 'acc-1',
        version: 1,
        evidenceType: 'verifier_assessment',
        documentRef: null,
        description: 'I play chess',
        requestedLevel: 'beginner',
        approvedLevel: null,
        status: 'pending',
        claimedBy: null,
        claimedAt: null,
        reason: null,
        decidedAt: null,
        submittedAt: '2026-10-12T00:00:00.000Z',
      }),
    );
    const mod = await gatewayWith({ accessToken: 'a', refreshToken: 'r' });

    const result = await new mod.HttpSkillsGateway().submitEvidence({
      skillId: 'skill-1',
      requestedLevel: 'beginner',
      evidenceType: 'verifier_assessment',
      description: 'I play chess',
    });

    expect(result.id).toBe('ev-1');
    const [, init] = mockCallApi.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      skillId: 'skill-1',
      requestedLevel: 'beginner',
      evidenceType: 'verifier_assessment',
      description: 'I play chess',
    });
  });

  it('rejects an empty description locally, before any network call', async () => {
    mockCallApi = vi.fn();
    const mod = await gatewayWith({ accessToken: 'a', refreshToken: 'r' });

    await expect(
      new mod.HttpSkillsGateway().submitEvidence({
        skillId: 'skill-1',
        requestedLevel: 'beginner',
        evidenceType: 'verifier_assessment',
        description: '   ',
      }),
    ).rejects.toThrow();
    expect(mockCallApi).not.toHaveBeenCalled();
  });

  it('encodes the evidence id when reading history', async () => {
    mockCallApi = vi.fn(async () =>
      envelope({ profileSkillId: 'ps-1', skillId: 'skill-1', versions: [] }),
    );
    const mod = await gatewayWith({ accessToken: 'a', refreshToken: 'r' });

    await new mod.HttpSkillsGateway().getEvidenceHistory('ev 1/2');

    expect(mockCallApi).toHaveBeenCalledWith('/skill-evidence/ev%201%2F2/history');
  });

  it('rejects a blank evidence id without calling the API', async () => {
    mockCallApi = vi.fn();
    const mod = await gatewayWith({ accessToken: 'a', refreshToken: 'r' });

    await expect(new mod.HttpSkillsGateway().getEvidenceHistory('   ')).rejects.toThrow();
    expect(mockCallApi).not.toHaveBeenCalled();
  });
});
