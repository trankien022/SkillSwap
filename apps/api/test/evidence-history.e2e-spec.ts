import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient } from './support/api-client';
import { resetDatabase, seedSkill, seedVerifier, waitVerifiedStudent } from './support/db';

jest.setTimeout(60_000);

/**
 * FR-018 (ADR-028) against the REAL stack: every evidence version keeps an immutable
 * audit trail. submit v1 → reject → submit v2 → approve → the history shows both
 * versions, their decisions, and v1 superseded by the approved v2 (AC-016).
 */
describe('E2E: evidence decision history (FR-018)', () => {
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
      displayName: 'History Learner',
      password: 'learner-password',
      role: 'user',
    });
    return accountIdFromToken(res.json.accessToken);
  }

  async function verifyStudent(learnerId: string, adminId: string): Promise<void> {
    api.actAs(learnerId, 'user');
    const target = await api.post('/api/student-verifications/documents', {
      fileName: 'transcript.pdf',
      contentType: 'application/pdf',
      sizeBytes: 512,
    });
    const submitted = await api.post('/api/student-verifications', {
      schoolName: 'FPT University',
      documentId: target.json.documentId as string,
    });
    api.actAs(adminId, 'admin');
    await api.post(`/api/student-verifications/${submitted.json.id}/decision`, { decision: 'approve' });
  }

  async function waitVerified(learnerId: string): Promise<void> {
    await waitVerifiedStudent(harness, learnerId);
  }

  it('shows both versions with decisions and the supersession', async () => {
    const skillId = await seedSkill(harness, { name: 'Rust', category: 'Programming' });
    const learnerId = await registerLearner('fr18-owner@skillswap.test');
    await verifyStudent(learnerId, 'admin-fr18-1');
    await waitVerified(learnerId);
    await seedVerifier(harness, { accountId: 'vf-rust', expertise: [skillId] });

    // v1: submit → reject.
    api.actAs(learnerId, 'user');
    const v1 = await api.post('/api/skill-evidence', {
      skillId,
      requestedLevel: 'intermediate',
      evidenceType: 'certificate',
      documentRef: 'docs/rust-1.pdf',
    });
    expect(v1.status).toBe(201);
    api.actAs('vf-rust', 'verifier');
    await api.post(`/api/skill-evidence/${v1.json.id}/claim`);
    const rejected = await api.post(`/api/skill-evidence/${v1.json.id}/decision`, {
      decision: 'reject',
      reason: 'Missing proof of projects',
    });
    expect(rejected.json.status).toBe('rejected');

    // v2: submit → approve (supersedes nothing yet; v1 stays rejected).
    api.actAs(learnerId, 'user');
    const v2 = await api.post('/api/skill-evidence', {
      skillId,
      requestedLevel: 'advanced',
      evidenceType: 'certificate',
      documentRef: 'docs/rust-2.pdf',
    });
    expect(v2.json.version).toBe(2);
    api.actAs('vf-rust', 'verifier');
    await api.post(`/api/skill-evidence/${v2.json.id}/claim`);
    const approved = await api.post(`/api/skill-evidence/${v2.json.id}/decision`, {
      decision: 'approve',
      approvedLevel: 'advanced',
    });
    expect(approved.json.status).toBe('approved');

    // The owner reads the full history from either version id.
    api.actAs(learnerId, 'user');
    const history = await api.get(`/api/skill-evidence/${v2.json.id}/history`);
    expect(history.status).toBe(200);
    expect(history.json.skillId).toBe(skillId);
    expect(history.json.versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);

    const [v2h, v1h] = history.json.versions;
    expect(v2h.currentStatus).toBe('approved');
    expect(v2h.entries.map((e: { action: string }) => e.action)).toEqual([
      'approved',
      'claimed',
      'submitted',
    ]);
    expect(v2h.entries[0].snapshot.approvedLevel).toBe('advanced');

    expect(v1h.currentStatus).toBe('rejected');
    expect(v1h.entries.map((e: { action: string }) => e.action)).toEqual([
      'rejected',
      'claimed',
      'submitted',
    ]);
    expect(v1h.entries[0].reason).toBe('Missing proof of projects');
  });

  it('supersedes a prior approval and records it in history (AC-016)', async () => {
    const skillId = await seedSkill(harness, { name: 'Go', category: 'Programming' });
    const learnerId = await registerLearner('fr18-supersede@skillswap.test');
    await verifyStudent(learnerId, 'admin-fr18-2');
    await waitVerified(learnerId);
    await seedVerifier(harness, { accountId: 'vf-go', expertise: [skillId] });

    // v1 approved at intermediate.
    api.actAs(learnerId, 'user');
    const v1 = await api.post('/api/skill-evidence', {
      skillId,
      requestedLevel: 'intermediate',
      evidenceType: 'certificate',
      documentRef: 'docs/go-1.pdf',
    });
    api.actAs('vf-go', 'verifier');
    await api.post(`/api/skill-evidence/${v1.json.id}/claim`);
    await api.post(`/api/skill-evidence/${v1.json.id}/decision`, { decision: 'approve' });

    // v2 approved at advanced — v1 is superseded.
    api.actAs(learnerId, 'user');
    const v2 = await api.post('/api/skill-evidence', {
      skillId,
      requestedLevel: 'advanced',
      evidenceType: 'certificate',
      documentRef: 'docs/go-2.pdf',
    });
    api.actAs('vf-go', 'verifier');
    await api.post(`/api/skill-evidence/${v2.json.id}/claim`);
    const approve2 = await api.post(`/api/skill-evidence/${v2.json.id}/decision`, {
      decision: 'approve',
      approvedLevel: 'advanced',
    });
    expect(approve2.status).toBe(200);

    api.actAs(learnerId, 'user');
    const history = await api.get(`/api/skill-evidence/${v2.json.id}/history`);
    const [v2h, v1h] = history.json.versions;
    expect(v2h.currentStatus).toBe('approved');
    expect(v1h.currentStatus).toBe('superseded');
    expect(v1h.entries.some((e: { action: string }) => e.action === 'superseded')).toBe(true);
  });

  it('refuses an unrelated account reading the history', async () => {
    const skillId = await seedSkill(harness, { name: 'Swift', category: 'Programming' });
    const learnerId = await registerLearner('fr18-private@skillswap.test');
    await verifyStudent(learnerId, 'admin-fr18-3');
    await waitVerified(learnerId);

    api.actAs(learnerId, 'user');
    const submitted = await api.post('/api/skill-evidence', {
      skillId,
      requestedLevel: 'beginner',
      evidenceType: 'certificate',
      documentRef: 'docs/swift.pdf',
    });

    api.actAs('nosy-user', 'user');
    const denied = await api.get(`/api/skill-evidence/${submitted.json.id}/history`);
    expect(denied.status).toBe(403);
    expect(denied.envelope.code).toBe('AccessDeniedError');
  });
});
