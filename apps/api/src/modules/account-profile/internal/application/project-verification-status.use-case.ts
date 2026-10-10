import type { StudentVerificationEvent } from '@skillswap/contracts';
import type { VerificationStatusWriter } from './port/out/verification-status-projector';

/**
 * FR-017 / ADR-024: projects a `student.verification.*` event into the local
 * account-profile read model. Idempotent through the writer (last-writer-wins by
 * `occurredAt`), so a replayed or out-of-order event is safe (ADR-013).
 */
export class ProjectVerificationStatusUseCase {
  constructor(private readonly writer: VerificationStatusWriter) {}

  async execute(event: StudentVerificationEvent): Promise<void> {
    await this.writer.upsert({
      accountId: event.accountId,
      verificationId: event.verificationId,
      status: event.status,
      reason: event.reason,
      occurredAt: event.occurredAt,
    });
  }
}
