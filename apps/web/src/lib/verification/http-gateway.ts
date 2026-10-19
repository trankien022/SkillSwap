import {
  adminDashboardSchema,
  adminVerificationPageSchema,
  adminVerifierQueuePageSchema,
  auditLogPageSchema,
  verifierSchema,
  verifierStatusChangeSchema,
  verifierQueuePageSchema,
  skillEvidenceViewSchema,
  skillEvidenceDecisionSchema,
  verificationDecisionSchema,
  verificationRevocationSchema,
  studentVerificationSchema,
  type AdminDashboard,
  type AdminVerificationPage,
  type AdminVerifierQueuePage,
  type AuditLogPage,
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

    const qs = params.toString();
    const path = qs ? `/verifiers/me/queue?${qs}` : '/verifiers/me/queue';
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

  // ---------------------------------------------------------------------------
  // FR-015 / ADR-034: the admin operations reads.
  //
  // All three are `admin`-only, so they share `AdminAuthError` with the decisions
  // above: a 401/403 is one UI state ("not an admin session"), not two.
  //
  // Each method builds its query string from the caller's filters rather than
  // sending undefined params, because an empty `?status=` is a 400 (the contract
  // validates `status` as an enum) whereas an omitted param is the unfiltered
  // query. Response shapes are parsed with the shared Zod schema, so a backend
  // that changed a field name fails here instead of rendering `undefined`.
  // ---------------------------------------------------------------------------

  /** GET /student-verifications — the admin-wide student-verification queue. */
  async listAdminVerifications(query: {
    limit?: number;
    cursor?: string;
    status?: string;
    q?: string;
    sort?: string;
  } = {}): Promise<AdminVerificationPage> {
    const path = `/student-verifications${buildQuery(query)}`;
    const res = await callApi(path);
    if (res.status === 401 || res.status === 403) throw new AdminAuthError();
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, 'Could not load student verifications'));
    }

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return adminVerificationPageSchema.parse(body?.data);
  }

  /** GET /verifiers/admin/queue — the admin-wide Verifier queue, by domain. */
  async listAdminVerifierQueue(query: {
    limit?: number;
    cursor?: string;
    domain?: string;
    status?: string;
    q?: string;
    sort?: string;
  } = {}): Promise<AdminVerifierQueuePage> {
    const path = `/verifiers/admin/queue${buildQuery(query)}`;
    const res = await callApi(path);
    if (res.status === 401 || res.status === 403) throw new AdminAuthError();
    if (!res.ok) {
      throw new Error(await readErrorMessage(res, 'Could not load the verifier queue'));
    }

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return adminVerifierQueuePageSchema.parse(body?.data);
  }

  /** GET /audit-log — the admin audit log, filterable by actor, time and action. */
  async listAuditLog(query: {
    limit?: number;
    cursor?: string;
    actorId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    from?: string;
    to?: string;
    q?: string;
    sort?: string;
  } = {}): Promise<AuditLogPage> {
    const path = `/audit-log${buildQuery(query)}`;
    const res = await callApi(path);
    if (res.status === 401 || res.status === 403) throw new AdminAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not load the audit log'));

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return auditLogPageSchema.parse(body?.data);
  }

  /** GET /admin-operation/dashboard — the counts-only operations aggregate. */
  async getAdminDashboard(): Promise<AdminDashboard> {
    const res = await callApi('/admin-operation/dashboard');
    if (res.status === 401 || res.status === 403) throw new AdminAuthError();
    if (!res.ok) throw new Error(await readErrorMessage(res, 'Could not load the dashboard'));

    const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
    return adminDashboardSchema.parse(body?.data);
  }
}

/**
 * Turns a filter object into a query string, skipping absent values.
 *
 * Deliberately drops empty strings as well as `undefined`: a form field the
 * admin left blank must mean "no filter", not `?q=` (which the contract rejects
 * as too short and would surface as a confusing 400).
 */
function buildQuery(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}
