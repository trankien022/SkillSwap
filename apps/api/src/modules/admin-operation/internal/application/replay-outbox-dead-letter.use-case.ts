import type {
  ReplayDeadLetterRequestInput,
  ReplayDeadLetterResultView,
} from '@skillswap/contracts';
import type { ReplayOutboxDeadLetterPort } from './port/in/outbox-dead-letters';
import type { AdminAuditEventRepository } from './port/out/admin-audit-event-repository';
import type { OutboxDeadLetterRepository } from './port/out/outbox-dead-letter-repository';

/** ADR-034: the dotted action an audited replay writes (matches `auditActionCodeSchema`). */
export const REPLAY_ACTION = 'outbox.dead_letter.replayed';

/**
 * FR-015 / ADR-013 Amendment A (W2 C3, decided 2026-10-25): replay one dead letter.
 *
 * An Administrator, one row at a time, audited. The audit row is written **after** the row
 * actually moves, so a double click does not fabricate a second audit entry for work that did
 * not happen — `replayed: false` means nothing was written and nothing is logged.
 *
 * `actorId` is a required argument rather than something read from a request context: this is
 * the call site where the programme's "an audited action must name its actor" rule is
 * enforced, and it would be easy to forget if the adapter looked it up itself.
 *
 * Maker/checker was considered and rejected (Amendment A, C3): with publish errors classified,
 * a `DEAD` row means the payload is broken, so a replay is a rare, small, reviewable action
 * and an audit trail is the proportionate control.
 */
export class ReplayOutboxDeadLetterUseCase implements ReplayOutboxDeadLetterPort {
  constructor(
    private readonly deadLetters: OutboxDeadLetterRepository,
    private readonly audit: AdminAuditEventRepository,
  ) {}

  async execute(
    request: ReplayDeadLetterRequestInput,
    actorId: string,
  ): Promise<ReplayDeadLetterResultView> {
    const result = await this.deadLetters.replay(request.module, request.id);
    if (!result.replayed) {
      return result;
    }

    await this.audit.append({
      actorId,
      action: REPLAY_ACTION,
      targetType: 'outbox_message',
      targetId: request.id,
      oldState: { module: request.module, status: 'DEAD' },
      newState: { module: request.module, status: result.status },
      occurredAt: new Date(),
      traceId: null,
      metadata: null,
      sourceEventId: null,
    });

    return result;
  }
}
