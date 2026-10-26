import { AdminDashboardController } from './admin-dashboard.controller';
import type { AdminDashboard } from '@skillswap/contracts';
import type { GetAdminDashboardPort } from '../../../application/port/in/get-admin-dashboard';
import { ROLES_KEY } from '../../../../../../shared/http/roles.decorator';

/**
 * FR-015: the operations dashboard is `admin`-only.
 *
 * The aggregate describes the whole platform's workload, so the role gate is the security
 * property here. Pinned through the metadata `@Roles` writes, because a spec that only called
 * `read()` would keep passing if the decorator were removed.
 */
describe('AdminDashboardController', () => {
  const PATH_METADATA = 'path';

  const dashboard: AdminDashboard = {
    verifications: { pending: 0, approved: 0, rejected: 0, revoked: 0 },
    evidence: { pending: 0, claimed: 0, approved: 0, rejected: 0, superseded: 0 },
    evidenceByDomain: {},
    recentAuditEvents: [],
    suspendedAccounts: { total: 0 },
    generatedAt: '2026-10-15T00:00:00.000Z',
  };

  it('returns the composed aggregate', async () => {
    const port: GetAdminDashboardPort = { execute: jest.fn().mockResolvedValue(dashboard) };
    const controller = new AdminDashboardController(port);

    await expect(controller.read()).resolves.toEqual(dashboard);
    expect(port.execute).toHaveBeenCalledTimes(1);
  });

  it('is gated to the admin role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminDashboardController.prototype.read) as unknown;
    expect(roles).toEqual(['admin']);
  });

  it('serves the aggregate at both the shipped and the operations path', () => {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, AdminDashboardController) as unknown;
    const handlerPath = Reflect.getMetadata(
      PATH_METADATA,
      AdminDashboardController.prototype.read,
    ) as string;
    // Two paths, one handler: the shipped route keeps working while the lock list lands under
    // `operations/`, so the aggregate is reachable from both (ADR-034 §7 / W6 plan).
    expect(controllerPath).toEqual(['admin-operation/dashboard', 'operations/dashboard']);
    expect(handlerPath).toBe('/');
  });
});
