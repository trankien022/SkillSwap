import { z } from 'zod';
import { pagedSchema, paginationQuerySchema } from './pagination';
import { studentVerificationSchema, verificationStatusSchema } from './verification';

/**
 * FR-015 / ADR-034: the **admin-wide** student-verification queue.
 *
 * Until now the only verification read was `GET /student-verifications/me` (the caller's own
 * row), so an administrator had no way to see the queue at all — the web page took a pasted
 * id. This is that missing list. It is admin-only and deliberately **not** account-scoped:
 * an administrator reviews other people's submissions, which is the point of the surface.
 *
 * Filters are the ones the SRS queue needs: `status` (the four lifecycle states) and a
 * free-text `schoolName` search. `sort` is whitelisted to the orders the supporting index
 * `student_verifications(status, submitted_at, id)` can serve.
 */
export const adminVerificationQuerySchema = paginationQuerySchema.extend({
  status: verificationStatusSchema.optional(),
  /** Free-text match over the school name. */
  q: z.string().min(2).max(120).optional(),
  sort: z.enum(['submittedAt', '-submittedAt', 'decidedAt', '-decidedAt']).optional(),
});
export type AdminVerificationQueryInput = z.infer<typeof adminVerificationQuerySchema>;

/** FR-015: a page of the admin student-verification queue. */
export const adminVerificationPageSchema = pagedSchema(studentVerificationSchema);
export type AdminVerificationPage = z.infer<typeof adminVerificationPageSchema>;
