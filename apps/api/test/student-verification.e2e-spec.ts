import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase } from './support/db';

jest.setTimeout(60_000);

/**
 * FR-002 (ADR-023) against the REAL stack (Postgres + RabbitMQ): a Learner
 * submits, an Administrator decides, and the owner-scoped read reflects status
 * and reason. The emitted event flows through the outbox.
 */
describe('E2E: student verification (FR-002)', () => {
  let harness: Harness;
  let api: ApiClient;

  beforeAll(async () => {
    harness = await startHarness();
    api = new ApiClient(harness.baseUrl);
    await resetDatabase(harness);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  async function registerLearner(email: string): Promise<string> {
    const res = await api.post('/api/auth/register', {
      email,
      displayName: 'Verify Learner',
      password: 'learner-password',
      role: 'learner',
    });
    return accountIdFromToken(res.json.accessToken);
  }

  /** Requests a pre-signed upload target and returns the document metadata id. */
  async function requestDocumentUpload(): Promise<string> {
    const target = await api.post('/api/student-verifications/documents', {
      fileName: 'transcript.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(target.status).toBe(201);
    expect(target.json.uploadUrl).toContain('X-Amz-Signature');
    return target.json.documentId as string;
  }

  it('submits (with an uploaded document), rejects with a reason, and the owner sees it', async () => {
    const learnerId = await registerLearner('sv-reject@skillswap.test');
    api.actAs(learnerId);

    const documentId = await requestDocumentUpload();
    const submitted = await api.post('/api/student-verifications', {
      schoolName: 'FPT University',
      major: 'Software Engineering',
      documentId,
    });
    expect(submitted.status).toBe(201);
    expect(submitted.json.status).toBe('pending');
    const verificationId = submitted.json.id as string;

    // A second submission is refused while one is effective (SR-BR-011).
    const duplicate = await api.post('/api/student-verifications', {
      schoolName: 'FPT University',
      documentId,
    });
    expect(duplicate.status).toBe(409);

    // An unsupported document type is rejected at the upload boundary (NFR-008).
    const badUpload = await api.post('/api/student-verifications/documents', {
      fileName: 'malware.exe',
      contentType: 'application/x-msdownload',
      sizeBytes: 10,
    });
    expect(badUpload.status).toBe(415);

    // A non-admin cannot decide (NFR-009).
    api.actAs(learnerId, 'learner');
    const forbidden = await api.post(`/api/student-verifications/${verificationId}/decision`, {
      decision: 'reject',
      reason: 'nope',
    });
    expect(forbidden.status).toBe(403);

    // The Administrator rejects with a reason.
    api.actAs('admin-1', 'admin');
    const decided = await api.post(`/api/student-verifications/${verificationId}/decision`, {
      decision: 'reject',
      reason: 'Illegible document',
    });
    expect(decided.status).toBe(200);
    expect(decided.json.status).toBe('rejected');
    expect(decided.json.reason).toBe('Illegible document');
    expect(decided.json.reviewerId).toBe('admin-1');

    // The owner-scoped read (FR-017) reflects status + reason.
    api.actAs(learnerId, 'learner');
    const mine = await api.get('/api/student-verifications/me');
    expect(mine.status).toBe(200);
    expect(mine.json.status).toBe('rejected');
    expect(mine.json.reason).toBe('Illegible document');

    // The decision event reached the outbox and was published.
    await waitFor(async () => {
      const rows = await harness.query<{ status: string }>(
        'student-verification',
        `SELECT "status" FROM outbox_messages WHERE "event_type" = 'student.verification.rejected' LIMIT 1`,
      );
      return rows[0]?.status === 'PUBLISHED' ? rows : null;
    });
  });

  it('approves a pending verification (no expiry in the MVP)', async () => {
    const learnerId = await registerLearner('sv-approve@skillswap.test');
    api.actAs(learnerId, 'learner');

    const documentId = await requestDocumentUpload();
    const submitted = await api.post('/api/student-verifications', {
      schoolName: 'HCMUS',
      documentId,
    });
    const verificationId = submitted.json.id as string;

    api.actAs('admin-2', 'admin');
    const decided = await api.post(`/api/student-verifications/${verificationId}/decision`, {
      decision: 'approve',
      approvedMajor: 'Computer Science',
    });
    expect(decided.status).toBe(200);
    expect(decided.json.status).toBe('approved');
    expect(decided.json.major).toBe('Computer Science');
    expect(decided.json.expiresAt).toBeUndefined();

    api.actAs(learnerId, 'learner');
    const mine = await api.get('/api/student-verifications/me');
    expect(mine.json.status).toBe('approved');
  });
});
