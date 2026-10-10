import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase } from './support/db';

jest.setTimeout(60_000);

/**
 * FR-017 (ADR-024) against the REAL stack: the client-facing `GET /api/auth/me`
 * reflects the student verification status projected from `student.verification.*`
 * events (no cross-schema read).
 */
describe('E2E: learner account status (FR-017)', () => {
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
      displayName: 'Status Learner',
      password: 'learner-password',
      role: 'learner',
    });
    return accountIdFromToken(res.json.accessToken);
  }

  async function upload(): Promise<string> {
    const target = await api.post('/api/student-verifications/documents', {
      fileName: 'transcript.pdf',
      contentType: 'application/pdf',
      sizeBytes: 512,
    });
    return target.json.documentId as string;
  }

  /** Polls /auth/me until the projected verification status matches. */
  async function meUntilStatus(userId: string, status: string) {
    return waitFor(async () => {
      api.actAs(userId, 'learner');
      const me = await api.get('/api/auth/me');
      return me.json.studentVerification?.status === status ? me : null;
    });
  }

  it('shows null, then pending, then the decision with reason', async () => {
    const learnerId = await registerLearner('fr17-learner@skillswap.test');

    // No submission yet → null.
    api.actAs(learnerId, 'learner');
    const before = await api.get('/api/auth/me');
    expect(before.status).toBe(200);
    expect(before.json.studentVerification).toBeNull();
    expect(before.json.status).toBe('active');

    // Submit → the projection catches up to pending.
    const documentId = await upload();
    await api.post('/api/student-verifications', {
      schoolName: 'FPT University',
      major: 'Software Engineering',
      documentId,
    });
    const pending = await meUntilStatus(learnerId, 'pending');
    expect(pending.json.studentVerification).toEqual({ status: 'pending', reason: null });

    // Admin rejects → the reason is projected onto the owner's view.
    const verificationId = (await api.get('/api/student-verifications/me')).json.id as string;
    api.actAs('admin-1', 'admin');
    await api.post(`/api/student-verifications/${verificationId}/decision`, {
      decision: 'reject',
      reason: 'Illegible document',
    });

    const rejected = await meUntilStatus(learnerId, 'rejected');
    expect(rejected.json.studentVerification).toEqual({
      status: 'rejected',
      reason: 'Illegible document',
    });
  });

  it('shows approved after an admin approval', async () => {
    const learnerId = await registerLearner('fr17-approve@skillswap.test');
    api.actAs(learnerId, 'learner');

    const documentId = await upload();
    const submitted = await api.post('/api/student-verifications', {
      schoolName: 'HCMUS',
      documentId,
    });
    const verificationId = submitted.json.id as string;

    api.actAs('admin-2', 'admin');
    await api.post(`/api/student-verifications/${verificationId}/decision`, { decision: 'approve' });

    const approved = await meUntilStatus(learnerId, 'approved');
    expect(approved.json.studentVerification?.status).toBe('approved');
    expect(approved.json.studentVerification?.reason).toBeNull();
  });
});
