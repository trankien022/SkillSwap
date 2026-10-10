import { InvalidDeciderError, InvalidRevocationError, ReasonRequiredError } from '../domain/verification';
import { RevokeStudentVerificationUseCase } from './revoke-student-verification.use-case';
import { SubmitStudentVerificationUseCase } from './submit-student-verification.use-case';
import { DecideStudentVerificationUseCase } from './decide-student-verification.use-case';
import { VerificationNotFoundError } from './decide-student-verification.use-case';
import { InMemoryVerificationRepository, InMemoryVerificationDocumentRepository, fixedClock } from './testing/verification-fakes';

const now = new Date('2026-10-10T00:00:00.000Z');

function build() {
  const repo = new InMemoryVerificationRepository();
  const documents = new InMemoryVerificationDocumentRepository();
  const clock = fixedClock(now);
  return {
    repo,
    submit: new SubmitStudentVerificationUseCase(repo, documents, clock),
    decide: new DecideStudentVerificationUseCase(repo, clock),
    revoke: new RevokeStudentVerificationUseCase(repo, clock),
    documents,
  };
}

/** Submits + approves a verification, returning its id. */
async function approved(context: ReturnType<typeof build>): Promise<string> {
  const document = await context.documents.create({
    id: 'd1',
    accountId: 'a1',
    objectKey: 'a1/d1.pdf',
    fileName: 'transcript.pdf',
    contentType: 'application/pdf',
    sizeBytes: 500,
  });
  const view = await context.submit.execute({
    accountId: 'a1',
    schoolName: 'FPT University',
    documentId: document.id,
  });
  await context.decide.execute({
    verificationId: view.id,
    reviewerId: 'admin-1',
    reviewerRole: 'admin',
    decision: 'approve',
  });
  return view.id;
}

describe('RevokeStudentVerificationUseCase (FR-019 / ADR-025)', () => {
  it('revokes an approved verification and reports the reason', async () => {
    const context = build();
    const id = await approved(context);
    const view = await context.revoke.execute({
      verificationId: id,
      reviewerId: 'admin-2',
      reviewerRole: 'admin',
      reason: 'Fake document',
    });
    expect(view.status).toBe('revoked');
    expect(view.reason).toBe('Fake document');
    expect(view.reviewerId).toBe('admin-2');
  });

  it('requires the admin role (NFR-009)', async () => {
    const context = build();
    const id = await approved(context);
    await expect(
      context.revoke.execute({
        verificationId: id,
        reviewerId: 'u1',
        reviewerRole: 'learner',
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(InvalidDeciderError);
  });

  it('requires a reason', async () => {
    const context = build();
    const id = await approved(context);
    await expect(
      context.revoke.execute({ verificationId: id, reviewerId: 'admin-1', reviewerRole: 'admin', reason: '  ' }),
    ).rejects.toBeInstanceOf(ReasonRequiredError);
  });

  it('404s for an unknown verification', async () => {
    const context = build();
    await expect(
      context.revoke.execute({
        verificationId: 'missing',
        reviewerId: 'admin-1',
        reviewerRole: 'admin',
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(VerificationNotFoundError);
  });

  it('refuses to revoke a revoked verification', async () => {
    const context = build();
    const id = await approved(context);
    await context.revoke.execute({ verificationId: id, reviewerId: 'admin-1', reviewerRole: 'admin', reason: 'x' });
    await expect(
      context.revoke.execute({ verificationId: id, reviewerId: 'admin-1', reviewerRole: 'admin', reason: 'y' }),
    ).rejects.toBeInstanceOf(InvalidRevocationError);
  });

  it('lets the account re-verify after revocation (new submission is allowed)', async () => {
    const context = build();
    const id = await approved(context);
    await context.revoke.execute({ verificationId: id, reviewerId: 'admin-1', reviewerRole: 'admin', reason: 'x' });

    // The revoked row is no longer effective, so a fresh submission succeeds.
    const document = await context.documents.create({
      id: 'd2',
      accountId: 'a1',
      objectKey: 'a1/d2.pdf',
      fileName: 'transcript.pdf',
      contentType: 'application/pdf',
      sizeBytes: 500,
    });
    const resubmitted = await context.submit.execute({
      accountId: 'a1',
      schoolName: 'FPT University',
      documentId: document.id,
    });
    expect(resubmitted.status).toBe('pending');
    expect(resubmitted.id).not.toBe(id);
  });
});
