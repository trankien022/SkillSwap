import type { MobileConfig } from '../config';
import { GatewayClient } from './gateway-client';
import { VerifierGateway } from './verifier-gateway';

describe('VerifierGateway', () => {
  const config: MobileConfig = {
    gatewayBaseUrl: 'http://localhost:4000',
    apiBaseUrl: 'http://localhost:4000/api',
  };
  let fetchMock: jest.Mock;
  let client: GatewayClient;
  let gateway: VerifierGateway;

  const mockEvidenceItem = {
    id: 'ev-1',
    profileSkillId: 'ps-1',
    skillId: 'sk-1',
    skillName: 'TypeScript',
    category: 'Programming',
    ownerId: 'user-1',
    version: 1,
    evidenceType: 'certificate',
    documentRef: 'https://example.com/cert.pdf',
    description: 'Certified TypeScript Developer',
    requestedLevel: 'advanced',
    approvedLevel: null,
    status: 'pending',
    claimedBy: null,
    claimedAt: null,
    reason: null,
    decidedAt: null,
    submittedAt: '2026-10-14T00:00:00.000Z',
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    client = new GatewayClient(config, { fetchFn: fetchMock as unknown as typeof fetch });
    client.setTokenProvider({
      getAccessToken: async () => 'mock-token',
      refreshSession: async () => ({ tokens: { accessToken: 'next-token' } }),
    });
    gateway = new VerifierGateway(client);
  });

  const okResponse = (data: unknown) => ({
    ok: true,
    status: 200,
    json: async () => data,
  });

  describe('getQueue', () => {
    it('fetches queue and validates page contract', async () => {
      const pageData = {
        items: [mockEvidenceItem],
        page: {
          limit: 20,
          nextCursor: 'cursor-2',
          total: 1,
        },
      };

      fetchMock.mockResolvedValueOnce(okResponse(pageData));

      const result = await gateway.getQueue({
        limit: 20,
        level: 'advanced',
        type: 'certificate',
        q: 'Type',
        sort: '-submittedAt',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('http://localhost:4000/api/verifiers/me/queue');
      expect(url).toContain('limit=20');
      expect(url).toContain('level=advanced');
      expect(url).toContain('type=certificate');
      expect(url).toContain('q=Type');
      expect(url).toContain('sort=-submittedAt');
      expect(init.method).toBe('GET');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].skillName).toBe('TypeScript');
    });

    it('propagates 403 when user is not a verifier', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          code: 'ForbiddenError',
          message: 'Verifier role required',
          data: null,
          errors: [],
        }),
      });

      await expect(gateway.getQueue()).rejects.toThrow('Verifier role required');
    });
  });

  describe('claim', () => {
    it('claims pending evidence and returns updated claimed item', async () => {
      const claimedItem = {
        ...mockEvidenceItem,
        status: 'claimed',
        claimedBy: 'vf-1',
        claimedAt: '2026-10-14T01:00:00.000Z',
      };

      fetchMock.mockResolvedValueOnce(okResponse(claimedItem));

      const result = await gateway.claim('ev-1');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/skill-evidence/ev-1/claim');
      expect(init.method).toBe('POST');
      expect(result.status).toBe('claimed');
      expect(result.claimedBy).toBe('vf-1');
    });

    it('rejects empty evidence id before making network call', async () => {
      await expect(gateway.claim('')).rejects.toThrow('Evidence ID cannot be empty');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('decide', () => {
    it('approves claimed evidence with approvedLevel', async () => {
      const approvedItem = {
        ...mockEvidenceItem,
        status: 'approved',
        approvedLevel: 'advanced',
        decidedAt: '2026-10-14T02:00:00.000Z',
      };

      fetchMock.mockResolvedValueOnce(okResponse(approvedItem));

      const result = await gateway.decide('ev-1', {
        decision: 'approve',
        approvedLevel: 'advanced',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/skill-evidence/ev-1/decision');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        decision: 'approve',
        approvedLevel: 'advanced',
      });
      expect(result.status).toBe('approved');
      expect(result.approvedLevel).toBe('advanced');
    });

    it('rejects evidence when reason is supplied', async () => {
      const rejectedItem = {
        ...mockEvidenceItem,
        status: 'rejected',
        reason: 'Certificate blurred',
        decidedAt: '2026-10-14T02:00:00.000Z',
      };

      fetchMock.mockResolvedValueOnce(okResponse(rejectedItem));

      const result = await gateway.decide('ev-1', {
        decision: 'reject',
        reason: 'Certificate blurred',
      });

      expect(result.status).toBe('rejected');
      expect(result.reason).toBe('Certificate blurred');
    });

    it('enforces that rejection requires a non-empty reason by schema validation', async () => {
      await expect(
        gateway.decide('ev-1', {
          decision: 'reject',
          reason: '   ',
        }),
      ).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('never auto-replays a decision POST on 401', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Expired session',
          data: null,
          errors: [],
        }),
      });

      await expect(
        gateway.decide('ev-1', {
          decision: 'approve',
          approvedLevel: 'beginner',
        }),
      ).rejects.toThrow(/Automatic replay suppressed/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
