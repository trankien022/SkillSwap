import type { AdminAuditEventInput, AuditableMessage } from '../domain/audit-event';
import type { AdminAuditEventRepository } from './port/out/admin-audit-event-repository';
import { describeAuditedAction } from './audit-actions';

/**
 * FR-015 / ADR-034: turns one bus message into one appended audit row.
 *
 * This is the module's whole ingestion story: the mapping table in `audit-actions.ts` says which
 * events are audited and what action/target/state each one carries, and this use case appends the
 * result. An event with no mapping is **ignored**, not an error — this module subscribes only to
 * the events it audits, so a missing mapping is a programming mistake, and failing loudly would
 * poison the queue for every other consumer of the same event.
 *
 * Idempotency has two layers (ADR-034 §6): the framework's `processed_events` guard, and the
 * repository's `ON CONFLICT` on `source_event_id`. The second is what makes redelivery safe even
 * if the first is reset, so `append` returning false is a normal, expected outcome.
 *
 * The message shape is {@link AuditableMessage}, declared in the domain so neither this file nor
 * the mapping table has to import the other.
 */
export class RecordAdminAuditEventUseCase {
  constructor(private readonly audit: AdminAuditEventRepository) {}

  async execute(message: AuditableMessage): Promise<boolean> {
    const input = describeAuditedAction(message);
    if (input === null) {
      return false;
    }
    return this.audit.append(input);
  }
}

/** Re-exported so the module registrar can build the input without reaching into two files. */
export type { AdminAuditEventInput };
