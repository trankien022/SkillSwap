import { z } from 'zod';
import { pagedSchema, paginationQuerySchema } from './pagination';

/**
 * FR-015 / ADR-013 Amendment A (W2 C3, decided 2026-10-25): the outbox dead-letter
 * inbox.
 *
 * A row reaches `DEAD` only when C2 proved the **payload** is at fault — retrying it can
 * never succeed. Before this contract existed a dead letter was reachable only by
 * hand-written SQL, so a genuinely poisoned event disappeared without a trace. Listing
 * and replaying it are Administrator capabilities, not a developer one.
 *
 * The module name is part of the identity because every module owns its own schema and
 * therefore its own `outbox_messages` table (ADR-014); an id alone is not unique across
 * the seven schemas.
 */

/** The module that owned the outbox row, e.g. `live-class`. */
export const outboxModuleSchema = z
  .string()
  .min(2)
  .max(60)
  .regex(/^[a-z][a-z0-9-]*$/, 'must be a lowercase module name');

/** One dead-lettered outbox row. Read-only: replay is a separate action. */
export const outboxDeadLetterSchema = z.object({
  module: outboxModuleSchema,
  id: z.string().uuid(),
  eventType: z.string().min(1),
  attempts: z.number().int().min(0),
  lastError: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  /** When the row went terminal. Always present for a dead letter. */
  failedAt: z.string().datetime({ offset: true }),
  /**
   * The event body, exactly as it would be published. Included because diagnosing a
   * poisoned payload is the whole reason this endpoint exists — without it an
   * Administrator can only see *that* the row failed, not why.
   */
  payload: z.unknown(),
});
export type OutboxDeadLetterView = z.infer<typeof outboxDeadLetterSchema>;

export const outboxDeadLetterQuerySchema = paginationQuerySchema.extend({
  /** Restrict to one module's schema. Omitted means every module. */
  module: outboxModuleSchema.optional(),
  eventType: z.string().min(1).optional(),
});
export type OutboxDeadLetterQueryInput = z.infer<typeof outboxDeadLetterQuerySchema>;

/** Newest failure first: a queue is read from the freshest problem backwards. */
export const outboxDeadLetterPageSchema = pagedSchema(outboxDeadLetterSchema);
export type OutboxDeadLetterPage = z.infer<typeof outboxDeadLetterPageSchema>;

/** ADR-013 Amendment A (W2 C3): replay exactly one dead letter. */
export const replayDeadLetterRequestSchema = z.object({
  module: outboxModuleSchema,
  id: z.string().uuid(),
});
export type ReplayDeadLetterRequestInput = z.infer<typeof replayDeadLetterRequestSchema>;

/**
 * The result of a replay.
 *
 * `replayed` is `true` only when this call moved the row, so a repeated click is honest
 * rather than pretending to have done work twice. `status` reports what the row now is,
 * which is how an Administrator sees "someone already replayed this".
 */
export const replayDeadLetterResultSchema = z.object({
  replayed: z.boolean(),
  status: z.enum(['PENDING', 'PUBLISHED', 'DEAD']),
});
export type ReplayDeadLetterResultView = z.infer<typeof replayDeadLetterResultSchema>;
