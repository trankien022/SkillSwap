import {
  DuplicateActiveVerificationError,
  InvalidDeciderError,
  ReasonRequiredError,
} from '../domain/verification';
import { DocumentTooLargeError, UnsupportedDocumentTypeError } from '../domain/document-upload';
import {
  SubmitStudentVerificationUseCase,
  DocumentNotFoundError,
} from './submit-student-verification.use-case';
import {
  DecideStudentVerificationUseCase,
  VerificationNotPendingError,
} from './decide-student-verification.use-case';
import { GetMyVerificationQueryHandler } from './get-my-verification.query';
import { RequestDocumentUploadUseCase } from './request-document-upload.use-case';
import {
  FakeDocumentStore,
  InMemoryVerificationDocumentRepository,
  InMemoryVerificationRepository,
  fixedClock,
} from './testing/verification-fakes';

const now = new Date('2026-10-10T00:00:00.000Z');
const policy = { allowedContentTypes: ['application/pdf', 'image/png'], maxBytes: 1024 };

function build() {
  const repo = new InMemoryVerificationRepository();
  const documents = new InMemoryVerificationDocumentRepository();
  const clock = fixedClock(now);
  return {
    repo,
    documents,
    submit: new SubmitStudentVerificationUseCase(repo, documents, clock),
    decide: new DecideStudentVerificationUseCase(repo, clock),
    getMine: new GetMyVerificationQueryHandler(repo),
    requestUpload: new RequestDocumentUploadUseCase(documents, new FakeDocumentStore(() => now), policy, 900),
  };
}

/** Uploads a document and returns its metadata id. */
async function upload(
  requestUpload: RequestDocumentUploadUseCase,
  accountId: string,
  overrides: Partial<{ fileName: string; contentType: string; sizeBytes: number }> = {},
): Promise<string> {
  const target = await requestUpload.execute({
    accountId,
    fileName: overrides.fileName ?? 'transcript.pdf',
    contentType: overrides.contentType ?? 'application/pdf',
    sizeBytes: overrides.sizeBytes ?? 500,
  });
  return target.documentId;
}

describe('SubmitStudentVerificationUseCase (FR-002 / AC-001)', () => {
  it('creates a pending verification for the learner from an uploaded document', async () => {
    const { submit, requestUpload } = build();
    const documentId = await upload(requestUpload, 'a1');
    const view = await submit.execute({
      accountId: 'a1',
      schoolName: 'FPT University',
      major: 'SE',
      documentId,
    });
    expect(view.status).toBe('pending');
    expect(view.schoolName).toBe('FPT University');
    expect(view.major).toBe('SE');
    expect(view.reviewerId).toBeNull();
    expect(view.submittedAt).toBe(now.toISOString());
  });

  it('blocks a second submission while one is effective (SR-BR-011)', async () => {
    const { submit, requestUpload } = build();
    const d1 = await upload(requestUpload, 'a1');
    const d2 = await upload(requestUpload, 'a1');
    await submit.execute({ accountId: 'a1', schoolName: 'FPT', documentId: d1 });
    await expect(
      submit.execute({ accountId: 'a1', schoolName: 'FPT', documentId: d2 }),
    ).rejects.toBeInstanceOf(DuplicateActiveVerificationError);
  });

  it('refuses an unknown or non-owned document', async () => {
    const { submit, requestUpload } = build();
    const documentId = await upload(requestUpload, 'someone-else');
    await expect(
      submit.execute({ accountId: 'a1', schoolName: 'FPT', documentId }),
    ).rejects.toBeInstanceOf(DocumentNotFoundError);
  });
});

describe('RequestDocumentUploadUseCase (FR-002 / ADR-023)', () => {
  it('returns a pre-signed target and records pending metadata', async () => {
    const { requestUpload, documents } = build();
    const target = await requestUpload.execute({
      accountId: 'a1',
      fileName: 'transcript.pdf',
      contentType: 'application/pdf',
      sizeBytes: 500,
    });
    expect(target.uploadUrl).toContain('https://s3.local/');
    expect(target.objectKey).toContain('a1/');
    expect(target.expiresAt).toBe(new Date(now.getTime() + 900 * 1000).toISOString());
    const stored = await documents.findById(target.documentId);
    expect(stored?.status).toBe('pending');
  });

  it('rejects an unsupported content type (NFR-008)', async () => {
    const { requestUpload } = build();
    await expect(
      requestUpload.execute({ accountId: 'a1', fileName: 'x.exe', contentType: 'application/x-msdownload', sizeBytes: 10 }),
    ).rejects.toBeInstanceOf(UnsupportedDocumentTypeError);
  });

  it('rejects an oversized document (NFR-008)', async () => {
    const { requestUpload } = build();
    await expect(
      requestUpload.execute({ accountId: 'a1', fileName: 'big.pdf', contentType: 'application/pdf', sizeBytes: 2048 }),
    ).rejects.toBeInstanceOf(DocumentTooLargeError);
  });
});

describe('DecideStudentVerificationUseCase (FR-002 / AC-001, AC-012)', () => {
  async function submitted() {
    const context = build();
    const documentId = await upload(context.requestUpload, 'a1');
    const view = await context.submit.execute({
      accountId: 'a1',
      schoolName: 'FPT University',
      documentId,
    });
    return { ...context, id: view.id };
  }

  it('approves a pending verification (no expiry in the MVP)', async () => {
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
    expect(view).not.toHaveProperty('expiresAt');
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
    const { submit, decide, getMine, requestUpload } = build();
    const documentId = await upload(requestUpload, 'a1');
    const view = await submit.execute({ accountId: 'a1', schoolName: 'FPT', documentId });
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
