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
 *
 * `status` accepts a **comma-separated list** as well as a single value, because the screen has
 * to be able to ask for the two live statuses at once. A queue that can only be filtered to one
 * status at a time must choose between hiding unclaimed work and hiding work in progress, and
 * "what is actually in the queue" is the union of the two. Deciding the combination in the client
 * and issuing two paged reads would break the shared `total` and the keyset cursor, so the list
 * belongs in the query.
 */
export const adminVerifierQueueQuerySchema = paginationQuerySchema.extend({
  /** Taxonomy category, e.g. `Languages`, `Programming`. */
  domain: z.string().min(2).max(80).optional(),
  /**
   * `pending` = unclaimed; `claimed` = a Verifier has taken it and is reviewing. Either one
   * status, or several as a comma-separated list (e.g. `pending,claimed` for the live queue).
   */
  status: z
    .string()
    .transform((value) => value.split(',').map((part) => part.trim()).filter((part) => part.length > 0))
    .pipe(z.array(evidenceStatusSchema).min(1))
    .optional(),
  q: z.string().min(2).max(120).optional(),
  sort: z.enum(['submittedAt', '-submittedAt']).optional(),
});
export type AdminVerifierQueueQueryInput = z.infer<typeof adminVerifierQueueQuerySchema>;

/** FR-015: a page of the admin Verifier queue. */
export const adminVerifierQueuePageSchema = pagedSchema(skillEvidenceViewSchema);
export type AdminVerifierQueuePage = z.infer<typeof adminVerifierQueuePageSchema>;
