import {
  SessionExpiredRetryRequiredError,
} from '@/application/port/session-types';
import type { MobileConfig } from '../config';
import {
  GatewayClient,
  type SessionTokenProvider,
} from './gateway-client';
import { SkillEvidenceGateway } from './skill-evidence-gateway';

describe('SkillEvidenceGateway', () => {
  const config: MobileConfig = {
    gatewayBaseUrl: 'http://localhost:4000',
    apiBaseUrl: 'http://localhost:4000/api',
  };

  const sampleEvidenceView = {
    id: 'evi-101',
    profileSkillId: 'ps-202',
    skillId: 'skill-ts',
    skillName: 'TypeScript',
    category: 'Programming',
    ownerId: 'user-789',
    version: 1,
    evidenceType: 'certificate' as const,
    documentRef: 'cert-ts-2026.pdf',
    description: 'Certified TypeScript Professional',
    requestedLevel: 'advanced' as const,
    approvedLevel: null,
    status: 'pending' as const,
    claimedBy: null,
    claimedAt: null,
    reason: null,
    decidedAt: null,
    submittedAt: '2026-10-12T02:00:00.000Z',
  };

  const sampleProfileSkills = [
    {
      id: 'ps-1',
      skillId: 'skill-react',
      skillName: 'React',
      category: 'Frontend',
      approvedLevel: 'intermediate' as const,
    },
    {
      id: 'ps-2',
      skillId: 'skill-node',
      skillName: 'Node.js',
      category: 'Backend',
      approvedLevel: null,
    },
  ];

  const sampleHistory = {
    profileSkillId: 'ps-202',
    skillId: 'skill-ts',
    versions: [
      {
        version: 1,
        evidenceId: 'evi-100',
        currentStatus: 'rejected' as const,
        requestedLevel: 'advanced' as const,
        approvedLevel: null,
        submittedAt: '2026-10-10T12:00:00.000Z',
        entries: [
          {
            id: 'audit-1',
            evidenceId: 'evi-100',
            version: 1,
            action: 'submitted' as const,
            actorId: 'user-789',
            fromStatus: null,
            toStatus: 'pending' as const,
            reason: null,
            snapshot: {
              version: 1,
              status: 'pending' as const,
              evidenceType: 'certificate' as const,
              requestedLevel: 'advanced' as const,
              approvedLevel: null,
              reason: null,
            },
            occurredAt: '2026-10-10T12:00:00.000Z',
            traceId: null,
          },
          {
            id: 'audit-2',
            evidenceId: 'evi-100',
            version: 1,
            action: 'rejected' as const,
            actorId: 'verifier-1',
            fromStatus: 'claimed' as const,
            toStatus: 'rejected' as const,
            reason: 'Unverified certificate issuer',
            snapshot: {
              version: 1,
              status: 'rejected' as const,
              evidenceType: 'certificate' as const,
              requestedLevel: 'advanced' as const,
              approvedLevel: null,
              reason: 'Unverified certificate issuer',
            },
            occurredAt: '2026-10-11T09:00:00.000Z',
            traceId: null,
          },
        ],
      },
      {
        version: 2,
        evidenceId: 'evi-101',
        currentStatus: 'approved' as const,
        requestedLevel: 'advanced' as const,
        approvedLevel: 'advanced' as const,
        submittedAt: '2026-10-12T02:00:00.000Z',
        entries: [
          {
            id: 'audit-3',
            evidenceId: 'evi-101',
            version: 2,
            action: 'submitted' as const,
            actorId: 'user-789',
            fromStatus: null,
            toStatus: 'pending' as const,
            reason: null,
            snapshot: {
              version: 2,
              status: 'pending' as const,
              evidenceType: 'certificate' as const,
              requestedLevel: 'advanced' as const,
              approvedLevel: null,
              reason: null,
            },
            occurredAt: '2026-10-12T02:00:00.000Z',
            traceId: null,
          },
          {
            id: 'audit-4',
            evidenceId: 'evi-101',
            version: 2,
            action: 'approved' as const,
            actorId: 'verifier-1',
            fromStatus: 'claimed' as const,
            toStatus: 'approved' as const,
            reason: null,
            snapshot: {
              version: 2,
              status: 'approved' as const,
              evidenceType: 'certificate' as const,
              requestedLevel: 'advanced' as const,
              approvedLevel: 'advanced' as const,
              reason: null,
            },
            occurredAt: '2026-10-12T03:00:00.000Z',
            traceId: null,
          },
        ],
      },
    ],
  };

  let mockGatewayFetch: jest.Mock;
  let mockTokenProvider: jest.Mocked<SessionTokenProvider>;
  let gatewayClient: GatewayClient;
  let gateway: SkillEvidenceGateway;

  beforeEach(() => {
    mockGatewayFetch = jest.fn();
    mockTokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
      refreshSession: jest.fn().mockResolvedValue({
        tokens: { accessToken: 'refreshed-access-token' },
      }),
    };

    gatewayClient = new GatewayClient(config, {
      fetchFn: mockGatewayFetch as unknown as typeof fetch,
      tokenProvider: mockTokenProvider,
    });

    gateway = new SkillEvidenceGateway(gatewayClient);
  });

  describe('submitSkillEvidence', () => {
    it('submits valid evidence to exact /skill-evidence path and parses response', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleEvidenceView,
      });

      const result = await gateway.submitSkillEvidence({
        skillId: 'skill-ts',
        requestedLevel: 'advanced',
        evidenceType: 'certificate',
        documentRef: 'cert-ts-2026.pdf',
        description: 'Certified TypeScript Professional',
      });

      expect(mockGatewayFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockGatewayFetch.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/skill-evidence');
      expect(init.method).toBe('POST');
      expect(init.headers['Authorization']).toBe('Bearer test-access-token');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body)).toEqual({
        skillId: 'skill-ts',
        requestedLevel: 'advanced',
        evidenceType: 'certificate',
        documentRef: 'cert-ts-2026.pdf',
        description: 'Certified TypeScript Professional',
      });

      // Preserves pending status and null approvedLevel; no premature approval
      expect(result.status).toBe('pending');
      expect(result.approvedLevel).toBeNull();
      expect(result).toEqual(sampleEvidenceView);
    });

    it('validates body before send and rejects invalid skill level with ZodError without importing zod', async () => {
      let caughtError: unknown;
      try {
        await gateway.submitSkillEvidence({
          skillId: 'skill-ts',
          requestedLevel: 'master' as unknown as 'expert', // invalid level enum
          evidenceType: 'certificate',
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect((caughtError as Error).name).toBe('ZodError');
      // Body validation failed before sending: network was never called
      expect(mockGatewayFetch).not.toHaveBeenCalled();
    });

    it('propagates 403 Forbidden error when user is not authorized or unverified', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          statusCode: 403,
          message: 'Student verification required to submit skill evidence',
          error: 'STUDENT_VERIFICATION_REQUIRED',
        }),
      });

      await expect(
        gateway.submitSkillEvidence({
          skillId: 'skill-ts',
          requestedLevel: 'advanced',
          evidenceType: 'certificate',
        }),
      ).rejects.toMatchObject({
        name: 'GatewayHttpError',
        statusCode: 403,
        message: 'Student verification required to submit skill evidence',
      });
    });

    it('rejects with ZodError when server returns malformed evidence response without importing zod', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'evi-1',
          status: 'unknown_status', // invalid enum
        }),
      });

      let caughtError: unknown;
      try {
        await gateway.submitSkillEvidence({
          skillId: 'skill-ts',
          requestedLevel: 'intermediate',
          evidenceType: 'certificate',
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect((caughtError as Error).name).toBe('ZodError');
    });
  });

  describe('getMyProfileSkills', () => {
    it('fetches profile skills from exact /profile-skills/me path with Bearer token', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: sampleProfileSkills, page: null }),
      });

      const result = await gateway.getMyProfileSkills();

      expect(mockGatewayFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockGatewayFetch.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/profile-skills/me');
      expect(init.method).toBe('GET');
      expect(init.headers['Authorization']).toBe('Bearer test-access-token');
      expect(result).toEqual(sampleProfileSkills);
    });

    it('rejects with ZodError when response is not a valid profile collection', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ notAnArray: true }),
      });

      let caughtError: unknown;
      try {
        await gateway.getMyProfileSkills();
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect((caughtError as Error).name).toBe('ZodError');
    });
  });

  describe('getSkillEvidenceHistory', () => {
    it('denies empty or whitespace ID locally without calling network', async () => {
      await expect(gateway.getSkillEvidenceHistory('')).rejects.toThrow(
        'Evidence ID cannot be empty',
      );
      await expect(gateway.getSkillEvidenceHistory('   ')).rejects.toThrow(
        'Evidence ID cannot be empty',
      );

      expect(mockGatewayFetch).not.toHaveBeenCalled();
    });

    it('URI-encodes ID in path and returns full version history with audit entries', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleHistory,
      });

      const rawId = 'evi/special#123';
      const result = await gateway.getSkillEvidenceHistory(rawId);

      expect(mockGatewayFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockGatewayFetch.mock.calls[0];
      expect(url).toBe(
        `http://localhost:4000/api/skill-evidence/${encodeURIComponent(rawId)}/history`,
      );
      expect(init.method).toBe('GET');
      expect(init.headers['Authorization']).toBe('Bearer test-access-token');

      // Preserves historical versions, decisions (rejected and approved), and audit entries
      expect(result.versions).toHaveLength(2);
      expect(result.versions[0].currentStatus).toBe('rejected');
      expect(result.versions[0].entries).toHaveLength(2);
      expect(result.versions[1].currentStatus).toBe('approved');
      expect(result.versions[1].approvedLevel).toBe('advanced');
      expect(result).toEqual(sampleHistory);
    });

    it('rejects with ZodError when server returns invalid history schema', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          profileSkillId: 'ps-1',
          versions: 'not-an-array',
        }),
      });

      let caughtError: unknown;
      try {
        await gateway.getSkillEvidenceHistory('evi-101');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect((caughtError as Error).name).toBe('ZodError');
    });
  });

  describe('Session Expiration & Single-Flight Retry Invariants', () => {
    it('POST 401: suppresses automatic replay and throws SessionExpiredRetryRequiredError', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ statusCode: 401, message: 'Session expired' }),
      });

      await expect(
        gateway.submitSkillEvidence({
          skillId: 'skill-ts',
          requestedLevel: 'intermediate',
          evidenceType: 'certificate',
        }),
      ).rejects.toThrow(SessionExpiredRetryRequiredError);

      expect(mockGatewayFetch).toHaveBeenCalledTimes(1);
      expect(mockTokenProvider.refreshSession).not.toHaveBeenCalled();
    });

    it('GET 401: retries exactly once with refreshed session token through real GatewayClient', async () => {
      mockGatewayFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ statusCode: 401, message: 'Session expired' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: sampleProfileSkills, page: null }),
        });

      const result = await gateway.getMyProfileSkills();

      expect(mockGatewayFetch).toHaveBeenCalledTimes(2);
      expect(mockTokenProvider.refreshSession).toHaveBeenCalledTimes(1);

      const retryInit = mockGatewayFetch.mock.calls[1][1];
      expect(retryInit.headers['Authorization']).toBe('Bearer refreshed-access-token');
      expect(result).toEqual(sampleProfileSkills);
    });
  });
});
