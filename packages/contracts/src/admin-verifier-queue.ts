import { z } from 'zod';
import { pagedSchema, paginationQuerySchema } from './pagination';
import { evidenceStatusSchema, skillEvidenceViewSchema } from './skill-evidence';

/**
 * FR-015 / ADR-034: the **admin-wide** Verifier queue.
 *
 * `GET /verifiers/me/queue` is expertise-scoped: it returns only what the calling Verifier is
 * qualified to judge. FR-015 requires the queue *by domain* for an administrator, which is the
 * same rows **without** the `skill_id = ANY(expertise)` restriction, so an administrator can
 * see whether unclaimed work is piling up in a domain no active Verifier covers.
 *
 * `domain` filters on the taxonomy **category** (the SRS's "by domain"), `status` separates
 * work nobody has claimed from work in progress. `sort` mirrors the verifier queue's two
 * orders so the two views agree on what "oldest first" means.
 */
export const adminVerifierQueueQuerySchema = paginationQuerySchema.extend({
  /** Taxonomy category, e.g. `Languages`, `Programming`. */
  domain: z.string().min(2).max(80).optional(),
  /** `pending` = unclaimed; `claimed` = a Verifier has taken it and is reviewing. */
  status: evidenceStatusSchema.optional(),
  q: z.string().min(2).max(120).optional(),
  sort: z.enum(['submittedAt', '-submittedAt']).optional(),
});
export type AdminVerifierQueueQueryInput = z.infer<typeof adminVerifierQueueQuerySchema>;

/** FR-015: a page of the admin Verifier queue. */
export const adminVerifierQueuePageSchema = pagedSchema(skillEvidenceViewSchema);
export type AdminVerifierQueuePage = z.infer<typeof adminVerifierQueuePageSchema>;
