import { createZodDto } from 'nestjs-zod';
import {
  adminDashboardSchema,
  advanceStatusResultSchema,
  advanceStatusSchema,
  auditLogPageSchema,
  auditLogQuerySchema,
  moduleStatusSchema,
} from '@skillswap/contracts';

/** Request body for POST /admin-operation/status/advance. */
export class AdvanceStatusDto extends createZodDto(advanceStatusSchema) {}

/** Current module status returned by the status endpoints. */
export class ModuleStatusDto extends createZodDto(moduleStatusSchema) {}

/** Applied status transition returned by the advance endpoint. */
export class AdvanceStatusResultDto extends createZodDto(advanceStatusResultSchema) {}

/** FR-015: query params for GET /audit-log. */
export class AuditLogQueryDto extends createZodDto(auditLogQuerySchema) {}

/** FR-015: a page of the Admin audit log. */
export class AuditLogPageDto extends createZodDto(auditLogPageSchema) {}

/** FR-015: the operations dashboard aggregate. */
export class AdminDashboardDto extends createZodDto(adminDashboardSchema) {}
