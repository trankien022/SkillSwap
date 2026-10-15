import type { AdminVerifierQueuePage, AdminVerifierQueueQueryInput } from '@skillswap/contracts';

export const LIST_ADMIN_VERIFIER_QUEUE = Symbol('ListAdminVerifierQueue');

/**
 * FR-015: the Administrator's cross-domain Verifier queue.
 *
 * Unlike {@link ListVerifierQueuePort}, this is not scoped to any caller's expertise — an
 * administrator is asking what work exists in a domain and whether anyone has taken it, which
 * is exactly the question the expertise-scoped read cannot answer. Authorization is the
 * controller's (`@Roles('admin')`).
 */
export interface ListAdminVerifierQueuePort {
  execute(query: AdminVerifierQueueQueryInput): Promise<AdminVerifierQueuePage>;
}
