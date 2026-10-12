import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase, seedSkill } from './support/db';

jest.setTimeout(60_000);

/**
 * FR-003 (ADR-026) against the REAL stack: a **verified student** submits skill
 * evidence for a **known** skill at a requested level; a resubmission creates a new
 * version and keeps the previous effective approval (AC-016). The verified-student
 * gate is an ADR-024 projection, so the suite drives the real student-verification
 * flow first.
 */
describe('E2E: skill evidence submission (FR-003)', () => {
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
      displayName: 'Evidence Learner',
      password: 'learner-password',
      role: 'user',
    });
    return accountIdFromToken(res.json.accessToken);
  }

  /** Drives the FR-002 flow to approval so the account becomes a verified student. */
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
    await api.post(`/api/student-verifications/${submitted.json.id}/decision`, {
      decision: 'approve',
    });
  }

  /** Waits until the approved status has propagated to the event-fed projections. */
  async function waitVerified(learnerId: string): Promise<void> {
    await waitFor(async () => {
      api.actAs(learnerId, 'user');
      const me = await api.get('/api/auth/me');
      return me.json?.studentVerification?.status === 'approved' ? me : null;
    });
  }

  /** Submits evidence once the account is a projected verified student. */
  async function submitEvidence(learnerId: string, body: unknown) {
    await waitVerified(learnerId);
    api.actAs(learnerId, 'user');
    return api.post('/api/skill-evidence', body);
  }

  it('accepts evidence from a verified student and rejects an unverified one', async () => {
    const learnerId = await registerLearner('fr3-unverified@skillswap.test');
    const skillId = await seedSkill(harness, { name: 'React', category: 'Programming' });

    // Unverified → 403 (the projection has no approved row yet).
    api.actAs(learnerId, 'user');
    const denied = await api.post('/api/skill-evidence', {
      skillId,
      requestedLevel: 'intermediate',
      evidenceType: 'certificate',
      documentRef: 'docs/cert.pdf',
    });
    expect(denied.status).toBe(403);

    // Verify the student, then submit succeeds once the projection catches up.
    await verifyStudent(learnerId, 'admin-fr3-1');
    const accepted = await submitEvidence(learnerId, {
      skillId,
      requestedLevel: 'intermediate',
      evidenceType: 'certificate',
      documentRef: 'docs/cert.pdf',
    });
    expect(accepted.status).toBe(201);
    expect(accepted.json.status).toBe('pending');
    expect(accepted.json.version).toBe(1);
    expect(accepted.json.requestedLevel).toBe('intermediate');
    expect(accepted.json.approvedLevel).toBeNull();
  });

  it('rejects an unknown skill', async () => {
    const learnerId = await registerLearner('fr3-unknown@skillswap.test');
    await verifyStudent(learnerId, 'admin-fr3-2');

    const res = await submitEvidence(learnerId, {
      skillId: '00000000-0000-0000-0000-000000000000',
      requestedLevel: 'beginner',
      evidenceType: 'verifier_assessment',
      description: 'Reviewed portfolio',
    });
    expect(res.status).toBe(404);
    expect(res.envelope.code).toBe('UnknownSkillError');
  });

  it('creates a new version on resubmission (AC-016)', async () => {
    const learnerId = await registerLearner('fr3-version@skillswap.test');
    const skillId = await seedSkill(harness, { name: 'Guitar', category: 'Music' });
    await verifyStudent(learnerId, 'admin-fr3-3');

    const first = await submitEvidence(learnerId, {
      skillId,
      requestedLevel: 'beginner',
      evidenceType: 'certificate',
      documentRef: 'docs/guitar-1.pdf',
    });
    expect(first.status).toBe(201);

    api.actAs(learnerId, 'user');
    const second = await api.post('/api/skill-evidence', {
      skillId,
      requestedLevel: 'advanced',
      evidenceType: 'certificate',
      documentRef: 'docs/guitar-2.pdf',
    });

    expect(second.status).toBe(201);
    expect(second.json.version).toBe(first.json.version + 1);
    expect(second.json.profileSkillId).toBe(first.json.profileSkillId);

    // The owner view lists the skill once, with no effective level yet (FR-004 decides).
    const mine = await api.get('/api/profile-skills/me');
    expect(mine.status).toBe(200);
    const entry = mine.json.items.find((row: { id: string }) => row.id === first.json.profileSkillId);
    expect(entry).toBeDefined();
    expect(entry.approvedLevel).toBeNull();
  });
});
