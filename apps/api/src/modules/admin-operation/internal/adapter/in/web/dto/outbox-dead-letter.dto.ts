import { createZodDto } from 'nestjs-zod';
import {
  outboxDeadLetterPageSchema,
  outboxDeadLetterQuerySchema,
  replayDeadLetterRequestSchema,
  replayDeadLetterResultSchema,
} from '@skillswap/contracts';

/** FR-015: query params for GET /operations/outbox-dead-letters. */
export class OutboxDeadLetterQueryDto extends createZodDto(outboxDeadLetterQuerySchema) {}

/**
 * FR-015 / ADR-013 Amendment A (W2 C3): query params for the replay action.
 *
 * The module must be named because a row id is only unique inside one schema (ADR-014); the
 * generated schema therefore requires it, unlike the collection's optional filter.
 */
export class ReplayDeadLetterQueryDto extends createZodDto(
  replayDeadLetterRequestSchema.omit({ id: true }),
) {}

/** FR-015: a page of dead letters. */
export class OutboxDeadLetterPageDto extends createZodDto(outboxDeadLetterPageSchema) {}

/** FR-015 / ADR-013 Amendment A: the outcome of a replay. */
export class ReplayDeadLetterResultDto extends createZodDto(replayDeadLetterResultSchema) {}
