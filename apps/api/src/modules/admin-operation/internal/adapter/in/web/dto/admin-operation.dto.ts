import { createZodDto } from 'nestjs-zod';
import {
  adminDashboardSchema,
  auditLogPageSchema,
  auditLogQuerySchema,
  suspendedAccountsPageSchema,
  suspendedAccountsQuerySchema,
} from '@skillswap/contracts';

/** FR-015: query params for GET /audit-log. */
export class AuditLogQueryDto extends createZodDto(auditLogQuerySchema) {}

/** FR-015: a page of the Admin audit log. */
export class AuditLogPageDto extends createZodDto(auditLogPageSchema) {}

/** FR-015 / ADR-037: query params for the account-lock list (`?status=suspended&limit&cursor`). */
export class SuspendedAccountsQueryDto extends createZodDto(suspendedAccountsQuerySchema) {}

/** FR-015 / ADR-037: a page of suspended accounts. */
export class SuspendedAccountsPageDto extends createZodDto(suspendedAccountsPageSchema) {}

/** FR-015: the operations dashboard aggregate. */
export class AdminDashboardDto extends createZodDto(adminDashboardSchema) {}
