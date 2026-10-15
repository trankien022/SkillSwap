import { AUDITED_EVENT_TYPES, describeAuditedAction } from './audit-actions';
import { RecordAdminAuditEventUseCase } from './record-admin-audit-event.use-case';
import type {
  AdminAuditEventRepository,
  AdminAuditPage,
  AdminAuditQuery,
} from './port/out/admin-audit-event-repository';
import type { AdminAuditEventInput } from '../domain/audit-event';

/**
 * FR-015 / ADR-034: the audit mapping table and its consumer.
 *
 * Two properties matter most and are easy to regress:
 *
 * 1. **NFR-005**: a snapshot may only contain scalars. The table is hand-written precisely so a
 *    future payload field cannot ride into an append-only table, and this suite pins that a
 *    nested value never appears.
 * 2. **Idempotency**: redelivery must not duplicate. The repository owns `ON CONFLICT`, but the
 *    use case must not treat a false `append` as an error.
 */

class RecordingAuditRepository implements AdminAuditEventRepository {
  readonly appended: AdminAuditEventInput[] = [];
  /** When set, `append` reports that the row already existed. */
  duplicateNext = false;

  async append(input: AdminAuditEventInput): Promise<boolean> {
    if (this.duplicateNext) {
      this.duplicateNext = false;
      return false;
    }
    this.appended.push(input);
    return true;
  }

  async list(_query: AdminAuditQuery): Promise<AdminAuditPage> {
    return { items: [], nextCursor: null, total: 0 };
  }
}

function message(eventType: string, payload: unknown) {
  return { id: `evt-${eventType}`, eventType, payload };
}

describe('describeAuditedAction', () => {
  it('maps an approved student verification', () => {
    const input = describeAuditedAction(
      message(AUDITED_EVENT_TYPES.verificationApproved, {
        verificationId: 'v-1',
        accountId: 'acc-1',
        status: 'approved',
        schoolName: 'Test University',
        reason: null,
        occurredAt: '2026-10-15T00:00:00.000Z',
      }),
    );

    expect(input).toMatchObject({
      action: 'student.verification.approved',
      targetType: 'verification',
      targetId: 'v-1',
      newState: { status: 'approved', schoolName: 'Test University', reason: null },
      sourceEventId: 'evt-student.verification.approved',
    });
    expect(input?.occurredAt.toISOString()).toBe('2026-10-15T00:00:00.000Z');
  });

  it('maps a rejected verification and keeps the reason', () => {
    const input = describeAuditedAction(
      message(AUDITED_EVENT_TYPES.verificationRejected, {
        verificationId: 'v-2',
        accountId: 'acc-2',
        status: 'rejected',
        schoolName: 'Other School',
        reason: 'Illegible document',
        occurredAt: '2026-10-15T00:00:00.000Z',
      }),
    );

    expect(input?.action).toBe('student.verification.rejected');
    expect(input?.newState).toMatchObject({ reason: 'Illegible document' });
  });

  it('maps a skill-evidence decision with its taxonomy context', () => {
    const input = describeAuditedAction(
      message(AUDITED_EVENT_TYPES.evidenceApproved, {
        evidenceId: 'e-1',
        profileSkillId: 'ps-1',
        accountId: 'acc-1',
        skillId: 'sk-1',
        version: 2,
        requestedLevel: 'intermediate',
        status: 'approved',
        approvedLevel: 'intermediate',
        reason: null,
        occurredAt: '2026-10-15T00:00:00.000Z',
      }),
    );

    expect(input).toMatchObject({
      action: 'skill.evidence.approved',
      targetType: 'skill_evidence',
      targetId: 'e-1',
      newState: {
        status: 'approved',
        skillId: 'sk-1',
        version: 2,
        approvedLevel: 'intermediate',
      },
      metadata: { profileSkillId: 'ps-1' },
    });
  });

  it('maps a Verifier suspension and keeps the old→new pair', () => {
    const input = describeAuditedAction(
      message(AUDITED_EVENT_TYPES.verifierSuspended, {
        verifierId: 'vf-1',
        status: 'suspended',
        previousStatus: 'active',
        occurredAt: '2026-10-15T00:00:00.000Z',
      }),
    );

    expect(input).toMatchObject({
      action: 'skill.verifier.suspended',
      targetType: 'verifier_account',
      targetId: 'vf-1',
      oldState: { status: 'active' },
      newState: { status: 'suspended' },
    });
  });

  it('maps a wallet transaction while keeping money an integer', () => {
    const input = describeAuditedAction(
      message(AUDITED_EVENT_TYPES.walletTransactionCompleted, {
        transactionId: 'tx-1',
        accountId: 'acc-1',
        type: 'booking_payment',
        amountCredits: 150000,
        direction: 'debit',
        occurredAt: '2026-10-15T00:00:00.000Z',
        bookingId: 'b-1',
      }),
    );

    expect(input?.newState).toMatchObject({ amountCredits: 150000, direction: 'debit' });
    // Never a float, and never converted to VND here — the ledger owns that.
    expect(typeof (input?.newState as Record<string, unknown>).amountCredits).toBe('number');
    expect(Number.isInteger((input?.newState as Record<string, unknown>).amountCredits)).toBe(true);
    expect(input?.metadata).toEqual({ bookingId: 'b-1' });
  });

  it('ignores an event it does not audit', () => {
    expect(
      describeAuditedAction(
        message('booking.confirmed', { bookingId: 'b-1', occurredAt: '2026-10-15T00:00:00.000Z' }),
      ),
    ).toBeNull();
  });

  it('never puts a nested value in a snapshot (NFR-005)', () => {
    const input = describeAuditedAction(
      message(AUDITED_EVENT_TYPES.verificationApproved, {
        verificationId: 'v-1',
        accountId: 'acc-1',
        status: 'approved',
        schoolName: 'Test University',
        reason: null,
        occurredAt: '2026-10-15T00:00:00.000Z',
        // A field a future payload might gain: it must not appear in the row.
        document: { contents: 'base64…' },
      }),
    );

    const snapshot = { ...(input?.newState ?? {}), ...(input?.metadata ?? {}) };
    for (const value of Object.values(snapshot)) {
      // `null` is a legitimate scalar snapshot value (a reason that was not given); an object or
      // array is not — NFR-005 keeps document contents out of an append-only table.
      if (value === null) continue;
      expect(['string', 'number', 'boolean']).toContain(typeof value);
    }
    expect(Object.keys(snapshot)).not.toContain('document');
  });

  it('subscribes to exactly the events it can map', () => {
    // Every subscribed type must produce a row, or the consumer would be silently dead.
    const samples: Record<string, unknown> = {
      [AUDITED_EVENT_TYPES.verificationApproved]: {
        verificationId: 'v', accountId: 'a', status: 'approved', schoolName: 's',
        reason: null, occurredAt: '2026-10-15T00:00:00.000Z',
      },
      [AUDITED_EVENT_TYPES.verificationRejected]: {
        verificationId: 'v', accountId: 'a', status: 'rejected', schoolName: 's',
        reason: 'r', occurredAt: '2026-10-15T00:00:00.000Z',
      },
      [AUDITED_EVENT_TYPES.verificationRevoked]: {
        verificationId: 'v', accountId: 'a', status: 'revoked', schoolName: 's',
        reason: 'r', occurredAt: '2026-10-15T00:00:00.000Z',
      },
      [AUDITED_EVENT_TYPES.evidenceClaimed]: {
        evidenceId: 'e', profileSkillId: 'ps', accountId: 'a', skillId: 'sk', version: 1,
        requestedLevel: 'beginner', status: 'claimed', occurredAt: '2026-10-15T00:00:00.000Z',
      },
      [AUDITED_EVENT_TYPES.evidenceApproved]: {
        evidenceId: 'e', profileSkillId: 'ps', accountId: 'a', skillId: 'sk', version: 1,
        requestedLevel: 'beginner', status: 'approved', approvedLevel: 'beginner',
        occurredAt: '2026-10-15T00:00:00.000Z',
      },
      [AUDITED_EVENT_TYPES.evidenceRejected]: {
        evidenceId: 'e', profileSkillId: 'ps', accountId: 'a', skillId: 'sk', version: 1,
        requestedLevel: 'beginner', status: 'rejected', reason: 'r',
        occurredAt: '2026-10-15T00:00:00.000Z',
      },
      [AUDITED_EVENT_TYPES.verifierSuspended]: {
        verifierId: 'vf', status: 'suspended', previousStatus: 'active',
        occurredAt: '2026-10-15T00:00:00.000Z',
      },
      [AUDITED_EVENT_TYPES.verifierRevoked]: {
        verifierId: 'vf', status: 'revoked', previousStatus: 'suspended',
        occurredAt: '2026-10-15T00:00:00.000Z',
      },
      [AUDITED_EVENT_TYPES.walletTransactionCompleted]: {
        transactionId: 'tx', accountId: 'a', type: 'top_up', amountCredits: 1000,
        direction: 'credit', occurredAt: '2026-10-15T00:00:00.000Z',
      },
    };

    for (const eventType of Object.keys(AUDITED_EVENT_TYPES).map(
      (key) => AUDITED_EVENT_TYPES[key as keyof typeof AUDITED_EVENT_TYPES],
    )) {
      expect(samples[eventType]).toBeDefined();
      expect(describeAuditedAction(message(eventType, samples[eventType]))).not.toBeNull();
    }
  });
});

describe('RecordAdminAuditEventUseCase', () => {
  it('appends one row for an audited event', async () => {
    const repository = new RecordingAuditRepository();
    const useCase = new RecordAdminAuditEventUseCase(repository);

    const written = await useCase.execute(
      message(AUDITED_EVENT_TYPES.verifierSuspended, {
        verifierId: 'vf-1',
        status: 'suspended',
        previousStatus: 'active',
        occurredAt: '2026-10-15T00:00:00.000Z',
      }),
    );

    expect(written).toBe(true);
    expect(repository.appended).toHaveLength(1);
  });

  it('writes nothing for an event it does not audit', async () => {
    const repository = new RecordingAuditRepository();
    const useCase = new RecordAdminAuditEventUseCase(repository);

    const written = await useCase.execute(
      message('booking.confirmed', { bookingId: 'b-1', occurredAt: '2026-10-15T00:00:00.000Z' }),
    );

    expect(written).toBe(false);
    expect(repository.appended).toHaveLength(0);
  });

  it('treats a duplicate delivery as a no-op, not a failure', async () => {
    const repository = new RecordingAuditRepository();
    repository.duplicateNext = true;
    const useCase = new RecordAdminAuditEventUseCase(repository);

    const written = await useCase.execute(
      message(AUDITED_EVENT_TYPES.verifierSuspended, {
        verifierId: 'vf-1',
        status: 'suspended',
        previousStatus: 'active',
        occurredAt: '2026-10-15T00:00:00.000Z',
      }),
    );

    // The repository reported "already present"; that is success, not an error to retry.
    expect(written).toBe(false);
    expect(repository.appended).toHaveLength(0);
  });

  it('propagates a malformed payload instead of writing a partial row', async () => {
    const repository = new RecordingAuditRepository();
    const useCase = new RecordAdminAuditEventUseCase(repository);

    await expect(
      useCase.execute(message(AUDITED_EVENT_TYPES.verifierSuspended, { verifierId: 'vf-1' })),
    ).rejects.toThrow();
    expect(repository.appended).toHaveLength(0);
  });
});
