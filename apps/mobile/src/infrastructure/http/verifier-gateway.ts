import {
  skillEvidenceDecisionSchema,
  skillEvidenceViewSchema,
  verifierQueuePageSchema,
  verifierQueueQuerySchema,
  type SkillEvidenceDecisionInput,
  type SkillEvidenceView,
  type VerifierQueuePage,
  type VerifierQueueQueryInput,
} from '@skillswap/contracts';
import type { GatewayClient } from './gateway-client';

/**
 * HTTP gateway for verifier operations on mobile (TASK-02, FR-004, BR-071, API-003).
 *
 * Implements:
 * - GET /api/verifiers/me/queue: Verifier's expertise-scoped pending evidence queue (paged).
 * - POST /api/skill-evidence/{id}/claim: Claims an evidence item to lock it for review.
 * - POST /api/skill-evidence/{id}/decision: Approves or rejects claimed evidence with level/reason.
 *
 * Invariants:
 * - Uses shared schemas from @skillswap/contracts.
 * - Strictly routes calls through GatewayClient.authenticatedRequest (authoritative auth & GET-retries).
 * - Never auto-replays POST mutations on 401.
 * - URI-encodes route path parameters and rejects empty IDs locally.
 */
export class VerifierGateway {
  constructor(private readonly gatewayClient: GatewayClient) {}

  /**
   * Reads a page of the Verifier's pending evidence queue (GET /api/verifiers/me/queue).
   */
  async getQueue(query?: VerifierQueueQueryInput): Promise<VerifierQueuePage> {
    const validatedQuery = query ? verifierQueueQuerySchema.parse(query) : undefined;
    const params = new URLSearchParams();

    if (validatedQuery?.limit !== undefined) {
      params.set('limit', String(validatedQuery.limit));
    }
    if (validatedQuery?.cursor !== undefined && validatedQuery.cursor.trim()) {
      params.set('cursor', validatedQuery.cursor.trim());
    }
    if (validatedQuery?.level !== undefined) {
      params.set('level', validatedQuery.level);
    }
    if (validatedQuery?.type !== undefined) {
      params.set('type', validatedQuery.type);
    }
    if (validatedQuery?.q !== undefined && validatedQuery.q.trim()) {
      params.set('q', validatedQuery.q.trim());
    }
    if (validatedQuery?.sort !== undefined) {
      params.set('sort', validatedQuery.sort);
    }

    const qs = params.toString();
    const path = `/verifiers/me/queue${qs ? `?${qs}` : ''}`;

    const raw = await this.gatewayClient.authenticatedRequest<unknown>(path, {
      method: 'GET',
    });

    return verifierQueuePageSchema.parse(raw);
  }

  /**
   * Claims a pending evidence request, locking it to the caller (POST /api/skill-evidence/{id}/claim).
   */
  async claim(evidenceId: string): Promise<SkillEvidenceView> {
    const trimmedId = evidenceId?.trim();
    if (!trimmedId) {
      throw new Error('Evidence ID cannot be empty');
    }

    const raw = await this.gatewayClient.authenticatedRequest<unknown>(
      `/skill-evidence/${encodeURIComponent(trimmedId)}/claim`,
      {
        method: 'POST',
      },
    );

    return skillEvidenceViewSchema.parse(raw);
  }

  /**
   * Approves or rejects a claimed evidence request (POST /api/skill-evidence/{id}/decision).
   */
  async decide(
    evidenceId: string,
    input: SkillEvidenceDecisionInput,
  ): Promise<SkillEvidenceView> {
    const trimmedId = evidenceId?.trim();
    if (!trimmedId) {
      throw new Error('Evidence ID cannot be empty');
    }

    const validatedInput = skillEvidenceDecisionSchema.parse(input);

    const raw = await this.gatewayClient.authenticatedRequest<unknown>(
      `/skill-evidence/${encodeURIComponent(trimmedId)}/decision`,
      {
        method: 'POST',
        body: validatedInput,
      },
    );

    return skillEvidenceViewSchema.parse(raw);
  }
}
