import { DuplicateActiveVerificationError, InvalidDeciderError, ReasonRequiredError } from '../domain/verification';
import { SubmitStudentVerificationUseCase } from './submit-student-verification.use-case';
import { DecideStudentVerificationUseCase, VerificationNotPendingError } from './decide-student-verification.use-case';
import { GetMyVerificationQueryHandler } from './get-my-verification.query';
import { InMemoryVerificationRepository, fixedClock } from './testing/verification-fakes';

const now = new Date('2026-10-10T00:00:00.000Z');

function build() {
  const repo = new InMemoryVerificationRepository();
  const clock = fixedClock(now);
  return {
    repo,
    submit: new SubmitStudentVerificationUseCase(repo, clock),
    decide: new DecideStudentVerificationUseCase(repo, clock),
    getMine: new GetMyVerificationQueryHandler(repo),
  };
}

describe('SubmitStudentVerificationUseCase (FR-002 / AC-001)', () => {
  it('creates a pending verification for the learner', async () => {
    const { submit } = build();
    const view = await submit.execute({
      accountId: 'a1',
      schoolName: 'FPT University',
      major: 'SE',
      documentRef: 'doc-1',
    });
    expect(view.status).toBe('pending');
    expect(view.schoolName).toBe('FPT University');
    expect(view.major).toBe('SE');
    expect(view.reviewerId).toBeNull();
    expect(view.submittedAt).toBe(now.toISOString());
  });

  it('blocks a second submission while one is effective (SR-BR-011)', async () => {
    const { submit } = build();
    await submit.execute({ accountId: 'a1', schoolName: 'FPT', documentRef: 'd1' });
    await expect(
      submit.execute({ accountId: 'a1', schoolName: 'FPT', documentRef: 'd2' }),
    ).rejects.toBeInstanceOf(DuplicateActiveVerificationError);
  });
});

describe('DecideStudentVerificationUseCase (FR-002 / AC-001, AC-012)', () => {
  async function submitted() {
    const context = build();
    const view = await context.submit.execute({
      accountId: 'a1',
      schoolName: 'FPT University',
      documentRef: 'doc-1',
    });
    return { ...context, id: view.id };
  }

  it('approves a pending verification and stamps expiry', async () => {
    const { decide, id } = await submitted();
    const view = await decide.execute({
      verificationId: id,
      reviewerId: 'admin-1',
      reviewerRole: 'admin',
      decision: 'approve',
      approvedMajor: 'Software Engineering',
    });
    expect(view.status).toBe('approved');
    expect(view.reviewerId).toBe('admin-1');
    expect(view.major).toBe('Software Engineering');
    expect(view.decidedAt).toBe(now.toISOString());
    expect(view.expiresAt).toBe(new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString());
  });

  it('rejects with a reason (AC-012)', async () => {
    const { decide, id } = await submitted();
    const view = await decide.execute({
      verificationId: id,
      reviewerId: 'admin-1',
      reviewerRole: 'admin',
      decision: 'reject',
      reason: 'Illegible document',
    });
    expect(view.status).toBe('rejected');
    expect(view.reason).toBe('Illegible document');
    expect(view.expiresAt).toBeNull();
  });

  it('requires a reason to reject', async () => {
    const { decide, id } = await submitted();
    await expect(
      decide.execute({
        verificationId: id,
        reviewerId: 'admin-1',
        reviewerRole: 'admin',
        decision: 'reject',
      }),
    ).rejects.toBeInstanceOf(ReasonRequiredError);
  });

  it('rejects a non-administrator decider (NFR-009)', async () => {
    const { decide, id } = await submitted();
    await expect(
      decide.execute({
        verificationId: id,
        reviewerId: 'u1',
        reviewerRole: 'learner',
        decision: 'approve',
      }),
    ).rejects.toBeInstanceOf(InvalidDeciderError);
  });

  it('refuses to decide an already-decided verification', async () => {
    const { decide, id } = await submitted();
    await decide.execute({
      verificationId: id,
      reviewerId: 'admin-1',
      reviewerRole: 'admin',
      decision: 'approve',
    });
    await expect(
      decide.execute({
        verificationId: id,
        reviewerId: 'admin-1',
        reviewerRole: 'admin',
        decision: 'reject',
        reason: 'oops',
      }),
    ).rejects.toBeInstanceOf(VerificationNotPendingError);
  });
});

describe('GetMyVerificationQueryHandler (FR-017)', () => {
  it('returns null when the account never submitted', async () => {
    const { getMine } = build();
    await expect(getMine.execute('nobody')).resolves.toBeNull();
  });

  it('returns the latest verification with its rejection reason', async () => {
    const { submit, decide, getMine } = build();
    const view = await submit.execute({ accountId: 'a1', schoolName: 'FPT', documentRef: 'd1' });
    await decide.execute({
      verificationId: view.id,
      reviewerId: 'admin-1',
      reviewerRole: 'admin',
      decision: 'reject',
      reason: 'Illegible document',
    });
    const mine = await getMine.execute('a1');
    expect(mine?.status).toBe('rejected');
    expect(mine?.reason).toBe('Illegible document');
  });
});
