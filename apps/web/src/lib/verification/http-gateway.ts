import {
  verifierSchema,
  verifierStatusChangeSchema,
  type VerifierStatusChangeInput,
  type VerifierView,
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
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  return body?.message ?? fallback;
}
