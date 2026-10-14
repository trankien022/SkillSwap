import {
  verifierSchema,
  verifierStatusChangeSchema,
  verifierQueuePageSchema,
  skillEvidenceViewSchema,
  skillEvidenceDecisionSchema,
  verificationDecisionSchema,
  verificationRevocationSchema,
  studentVerificationSchema,
  type VerifierStatusChangeInput,
  type VerifierView,
  type VerifierQueuePage,
  type SkillEvidenceView,
  type SkillEvidenceDecisionInput,
  type StudentVerificationDecisionInput,
  type VerificationRevocationInput,
  type StudentVerificationView,
} from '@skillswap/contracts';
import { callApi, getTokens } from '../api-client';

/**
 * Web verifier administration gateway (FR-004 / ADR-027).
 *
 * NOTE: this file is created by **TASK-03 (Tấn Hưng)** as a skeleton so the
 * admin control at `/[locale]/admin/verifiers/[accountId]` can ship without
 * blocking on TASK-01 (Long, who owns the verifier queue / claim / decision
 * surface). When Long's TASK-01 lands:
 *
 *   - he will publish additional Zod schemas in `packages/contracts`;
 *   - he will likely add the queue / claim / decision methods here;
 *
 * Please **append** new methods, do not refactor the existing ones, so
 * `setVerifierStatus` (this task) keeps working untouched.
 *
 * The class follows the same pattern as `HttpSkillsGateway`:
 *   - `callApi` attaches the bearer token and retries once on 401;
 *   - `isAuthenticated()` is the same predicate the rest of the web uses;
 *   - domain errors are typed (`AdminAuthError` mirrors `SkillsAuthError`).
 */

/** Raised when the caller has no session or the API returns 401/403. */
export class AdminAuthError extends Error {
  constructor(message = 'Admin session required to call this endpoint') {
    super(message);
    this.name = 'AdminAuthError';
  }
}

export class VerifierAuthError extends Error {
  constructor(message = 'Verifier session required to call this endpoint') {
    super(message);
    this.name = 'VerifierAuthError';
  }
}

export class HttpVerificationGateway {
  /** True when a session token is present. */
  isAuthenticated(): boolean {
    return getTokens() !== null;
  }

  /**
   * FR-004 / ADR-027: an administrator changes a Verifier's lifecycle status.
   *
   * Backend route is `POST /verifiers/{accountId}/status` (the path param is
   * `accountId`, not `verifierId`; see `verifier.controller.ts:42-58`).
   * The backend is `@Roles('admin')` and replies with the updated
   * `VerifierView` (`{ accountId, status, expertise }`).
   *
   * The `status` field is validated locally against the shared Zod schema
   * before the request leaves the browser — a typo in the form does not
   * become a 400 with a message the admin cannot act on.
   */
  async setVerifierStatus(
    accountId: string,
    input: VerifierStatusChangeInput,
  ): Promise<VerifierView> {
    if (!accountId.trim()) {
      throw new Error('Account id is required');
    }
    const payload = verifierStatusChangeSchema.parse(input);

    const res = await callApi(
      `/verifiers/${encodeURIComponent(accountId.trim())}/status`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );

    // 401 means the session is gone, 403 means the caller is not an admin.
    // Both belong to the same UI state ("not authorized"), so we surface them
    // with one typed error and let the page render the translated banner.
    if (res.status === 401 || res.status === 403) {
      throw new AdminAuthError();
    }
    if (!res.ok) {
      throw new Error(
        await readErrorMessage(res, 'Could not update the verifier status'),
      );
    }

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return verifierSchema.parse(body?.data);
  }

  /** GET /verifiers/me/queue */
  async getVerifierQueue(query: {
    limit?: number;
    cursor?: string;
    level?: string;
    type?: string;
    q?: string;
    sort?: string;
  }): Promise<VerifierQueuePage> {
    const params = new URLSearchParams();
    if (query.limit !== undefined) params.set('limit', String(query.limit));
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.level) params.set('level', query.level);
    if (query.type) params.set('type', query.type);
    if (query.q) params.set('q', query.q);
    if (query.sort) params.set('sort', query.sort);

    const path = `/verifiers/me/queue${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await callApi(path);
    if (res.status === 401) throw new VerifierAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not load verifier queue'));

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return verifierQueuePageSchema.parse(body?.data);
  }

  /** POST /skill-evidence/{id}/claim */
  async claimEvidence(evidenceId: string): Promise<SkillEvidenceView> {
    if (!evidenceId || !evidenceId.trim()) throw new Error('Evidence id is required');

    const res = await callApi(`/skill-evidence/${encodeURIComponent(evidenceId.trim())}/claim`, {
      method: 'POST',
    });

    if (res.status === 401) throw new VerifierAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not claim evidence'));

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return skillEvidenceViewSchema.parse(body?.data);
  }

  /** POST /skill-evidence/{id}/decision */
  async decideEvidence(evidenceId: string, input: SkillEvidenceDecisionInput): Promise<SkillEvidenceView> {
    if (!evidenceId || !evidenceId.trim()) throw new Error('Evidence id is required');

    const payload = skillEvidenceDecisionSchema.parse(input);

    const res = await callApi(`/skill-evidence/${encodeURIComponent(evidenceId.trim())}/decision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.status === 401) throw new VerifierAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not decide evidence'));

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return skillEvidenceViewSchema.parse(body?.data);
  }

  /** POST /student-verifications/{id}/decision */
  async decideStudentVerification(
    verificationId: string,
    input: StudentVerificationDecisionInput,
  ): Promise<StudentVerificationView> {
    if (!verificationId || !verificationId.trim()) throw new Error('Verification id is required');

    const payload = verificationDecisionSchema.parse(input);

    const res = await callApi(`/student-verifications/${encodeURIComponent(verificationId.trim())}/decision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.status === 401 || res.status === 403) throw new AdminAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not decide student verification'));

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return studentVerificationSchema.parse(body?.data);
  }

  /** POST /student-verifications/{id}/revocation */
  async revokeStudentVerification(verificationId: string, input: VerificationRevocationInput): Promise<StudentVerificationView> {
    if (!verificationId || !verificationId.trim()) throw new Error('Verification id is required');

    const payload = verificationRevocationSchema.parse(input);

    const res = await callApi(`/student-verifications/${encodeURIComponent(verificationId.trim())}/revocation`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.status === 401 || res.status === 403) throw new AdminAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not revoke student verification'));

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return studentVerificationSchema.parse(body?.data);
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}
