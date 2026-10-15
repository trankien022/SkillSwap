import type { AdminVerificationPage, AdminVerificationQueryInput } from '@skillswap/contracts';

export const LIST_ADMIN_VERIFICATIONS = Symbol('ListAdminVerifications');

/**
 * FR-015: the Administrator's verification queue.
 *
 * Admin-scoped by design — unlike every other read in this module it is not filtered to the
 * caller's own account, because the surface exists so an administrator can review other
 * people's submissions. Authorization is enforced at the controller (`@Roles('admin')`).
 */
export interface ListAdminVerificationsPort {
  execute(query: AdminVerificationQueryInput): Promise<AdminVerificationPage>;
}
