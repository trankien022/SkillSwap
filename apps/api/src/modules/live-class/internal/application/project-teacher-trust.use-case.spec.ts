import { ProjectTeacherTrustUseCase } from './project-teacher-trust.use-case';
import type {
  TeacherTrustWriter,
  UpsertVerifiedTeacherRequest,
} from './port/out/account-trust';
import type { StudentVerificationEvent } from '@skillswap/contracts';

/**
 * An in-memory stand-in for the `teacher_verified` row that honours the same last-writer-wins
 * rule as `sql-teacher-trust-projector.ts` (`WHERE occurred_at < EXCLUDED.occurred_at`). The
 * projector's own spec asserts that guard is in the SQL; this models it so the use case can be
 * driven with real events instead of a bare spy.
 */
class InMemoryTeacherVerificationTable implements TeacherTrustWriter {
  readonly rows = new Map<
    string,
    { verified: boolean; schoolName: string | null; occurredAt: string }
  >();

  async upsertVerified(request: UpsertVerifiedTeacherRequest): Promise<void> {
    const current = this.rows.get(request.accountId);
    if (current !== undefined && !(current.occurredAt < request.occurredAt)) {
      return; // an event at or below the applied one is ignored, not merged
    }
    this.rows.set(request.accountId, {
      verified: request.verified,
      schoolName: request.schoolName,
      occurredAt: request.occurredAt,
    });
  }

  async upsertSkillApproval(): Promise<void> {
    // not under test here
  }
}

function verificationEvent(
  overrides: Partial<StudentVerificationEvent> = {},
): StudentVerificationEvent {
  return {
    verificationId: 'ver-1',
    accountId: 'account-1',
    status: 'approved',
    schoolName: 'FPT University',
    reason: null,
    occurredAt: '2026-10-12T10:00:00.000Z',
    actorId: 'admin-1',
    ...overrides,
  };
}

describe('ProjectTeacherTrustUseCase — the school behind a verification (B4)', () => {
  it('keeps the school while the verification is approved', async () => {
    const table = new InMemoryTeacherVerificationTable();
    const useCase = new ProjectTeacherTrustUseCase(table);

    await useCase.onVerification(verificationEvent());

    expect(table.rows.get('account-1')).toEqual({
      verified: true,
      schoolName: 'FPT University',
      occurredAt: '2026-10-12T10:00:00.000Z',
    });
  });

  it('drops the school as soon as the verification is revoked', async () => {
    const table = new InMemoryTeacherVerificationTable();
    const useCase = new ProjectTeacherTrustUseCase(table);

    await useCase.onVerification(verificationEvent({ occurredAt: '2026-10-12T10:00:00.000Z' }));
    await useCase.onVerification(
      verificationEvent({
        status: 'revoked',
        reason: 'document was forged',
        occurredAt: '2026-10-13T10:00:00.000Z',
      }),
    );

    // Keeping the school after a revocation would keep advertising a status the account lost.
    expect(table.rows.get('account-1')).toMatchObject({
      verified: false,
      schoolName: null,
    });
  });

  it('does not re-advertise a school from a stale approval that arrives late', async () => {
    const table = new InMemoryTeacherVerificationTable();
    const useCase = new ProjectTeacherTrustUseCase(table);

    // The revocation is newer, so it wins even though the approval is replayed afterwards.
    await useCase.onVerification(
      verificationEvent({ status: 'revoked', occurredAt: '2026-10-13T10:00:00.000Z' }),
    );
    await useCase.onVerification(verificationEvent({ occurredAt: '2026-10-12T10:00:00.000Z' }));

    expect(table.rows.get('account-1')).toMatchObject({
      verified: false,
      schoolName: null,
      occurredAt: '2026-10-13T10:00:00.000Z',
    });
  });

  it('carries no school for a pending or rejected decision', async () => {
    const table = new InMemoryTeacherVerificationTable();
    const useCase = new ProjectTeacherTrustUseCase(table);

    await useCase.onVerification(verificationEvent({ status: 'pending', schoolName: 'HCMUS' }));
    expect(table.rows.get('account-1')).toMatchObject({ verified: false, schoolName: null });

    await useCase.onVerification(
      verificationEvent({ status: 'rejected', schoolName: 'HCMUS', occurredAt: '2026-10-13T10:00:00.000Z' }),
    );
    expect(table.rows.get('account-1')).toMatchObject({ verified: false, schoolName: null });
  });
});
