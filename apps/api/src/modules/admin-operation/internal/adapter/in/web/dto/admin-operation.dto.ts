import { createZodDto } from 'nestjs-zod';
import { adminDashboardSchema, auditLogPageSchema, auditLogQuerySchema } from '@skillswap/contracts';

/** FR-015: query params for GET /audit-log. */
export class AuditLogQueryDto extends createZodDto(auditLogQuerySchema) {}

/** FR-015: a page of the Admin audit log. */
export class AuditLogPageDto extends createZodDto(auditLogPageSchema) {}

/** FR-015: the operations dashboard aggregate. */
export class AdminDashboardDto extends createZodDto(adminDashboardSchema) {}
