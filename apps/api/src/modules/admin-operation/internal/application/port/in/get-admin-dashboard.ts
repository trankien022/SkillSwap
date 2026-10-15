import type { AdminDashboard } from '@skillswap/contracts';

export const GET_ADMIN_DASHBOARD = Symbol('GetAdminDashboard');

/**
 * FR-015 / ADR-034 §7: the operations dashboard aggregate.
 *
 * Authorization is the controller's (`@Roles('admin')`). The port takes no arguments: the screen
 * has no filters, because a filtered dashboard is a report and the queues are where reporting
 * already happens.
 */
export interface GetAdminDashboardPort {
  execute(): Promise<AdminDashboard>;
}
