import { AuditLogController } from './audit-log.controller';
import type { AuditLogPage } from '@skillswap/contracts';
import type { ListAuditLogPort } from '../../../application/port/in/list-audit-log';
import { ROLES_KEY } from '../../../../../../shared/http/roles.decorator';

/**
 * FR-015 / NFR-005: the audit log is readable only by an Administrator.
 *
 * An audit log that the audited can read is not an audit log, so the role gate is the security
 * property of this controller, not a detail. Pinned via the metadata `@Roles` writes, because a
 * spec that only calls the method would pass even if the decorator were deleted.
 */
describe('AuditLogController', () => {
  const PATH_METADATA = 'path';

  it('delegates the query to the port unchanged', async () => {
    const page: AuditLogPage = { items: [], page: { limit: 20, nextCursor: null, total: 0 } };
    const auditLog: ListAuditLogPort = { execute: jest.fn().mockResolvedValue(page) };
    const controller = new AuditLogController(auditLog);

    const query = { actorId: 'admin-1', sort: '-occurredAt' as const };
    await expect(controller.list(query)).resolves.toEqual(page);
    expect(auditLog.execute).toHaveBeenCalledWith(query);
  });

  it('is gated to the admin role', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AuditLogController.prototype.list) as unknown;
    expect(roles).toEqual(['admin']);
  });

  it('serves the log at GET /audit-log', () => {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, AuditLogController) as string;
    const handlerPath = Reflect.getMetadata(PATH_METADATA, AuditLogController.prototype.list) as string;
    expect(controllerPath).toBe('audit-log');
    // An empty handler path is how Nest composes `@Controller('audit-log')` + `@Get()` into
    // `GET /audit-log`; asserting it catches an accidental `@Get(':id')`.
    expect(handlerPath).toBe('/');
  });
});
