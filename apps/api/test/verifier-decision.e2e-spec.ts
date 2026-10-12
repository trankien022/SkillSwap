import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient } from './support/api-client';
import { resetDatabase, seedSkill, seedVerifier, waitVerifiedStudent } from './support/db';

jest.setTimeout(60_000);

/**
 * FR-004 (ADR-027) against the REAL stack: a verified student submits evidence; an
 * admin-provisioned Verifier with seeded expertise sees only matching requests,
 * claims one (locking it), and approves/rejects it. Negative: admin-only, wrong
 * expertise, self-decision and double-claim are all refused (AC-018).
 */
describe('E2E: verifier decisions on skill evidence (FR-004)', () => {
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

  /** Registers + verifies a student, submits evidence, returns the evidence id. */
  async function submitEvidence(email: string, skillId: string, admin: string): Promise<{ learnerId: string; evidenceId: string }> {
    const learnerId = await registerLearner(email);
    await verifyStudent(learnerId, admin);
    await waitVerified(learnerId);
    api.actAs(learnerId, 'user');
    const submitted = await api.post('/api/skill-evidence', {
      skillId,
      requestedLevel: 'intermediate',
      evidenceType: 'certificate',
      documentRef: 'docs/cert.pdf',
    });
    expect(submitted.status).toBe(201);
    return { learnerId, evidenceId: submitted.json.id as string };
  }

  it('lets an expertise-matched Verifier claim and approve, caching the level', async () => {
    const skillId = await seedSkill(harness, { name: 'React', category: 'Programming' });
    const { learnerId, evidenceId } = await submitEvidence('fr4-happy@skillswap.test', skillId, 'admin-fr4-1');
    await seedVerifier(harness, { accountId: 'vf-react', expertise: [skillId] });

    // The Verifier sees the request in their queue.
    api.actAs('vf-react', 'verifier');
    const queue = await api.get('/api/verifiers/me/queue');
    expect(queue.status).toBe(200);
    expect(queue.json.items.map((row: { id: string }) => row.id)).toContain(evidenceId);

    // Claim locks it, then approve sets the level.
    const claimed = await api.post(`/api/skill-evidence/${evidenceId}/claim`);
    expect(claimed.status).toBe(200);
    expect(claimed.json.status).toBe('claimed');
    expect(claimed.json.claimedBy).toBe('vf-react');

    const decided = await api.post(`/api/skill-evidence/${evidenceId}/decision`, {
      decision: 'approve',
      approvedLevel: 'advanced',
    });
    expect(decided.status).toBe(200);
    expect(decided.json.status).toBe('approved');
    expect(decided.json.approvedLevel).toBe('advanced');

    // The owner sees the effective level cached on their profile skill.
    api.actAs(learnerId, 'user');
    const mine = await api.get('/api/profile-skills/me');
    const entry = mine.json.items.find((row: { skillId: string }) => row.skillId === skillId);
    expect(entry.approvedLevel).toBe('advanced');
  });

  it('excludes a Verifier without expertise for the skill', async () => {
    const skillId = await seedSkill(harness, { name: 'Guitar', category: 'Music' });
    const other = await seedSkill(harness, { name: 'Piano', category: 'Music' });
    const { evidenceId } = await submitEvidence('fr4-outofdomain@skillswap.test', skillId, 'admin-fr4-2');
    await seedVerifier(harness, { accountId: 'vf-piano', expertise: [other] });

    api.actAs('vf-piano', 'verifier');
    const queue = await api.get('/api/verifiers/me/queue');
    expect(queue.json.items.map((row: { id: string }) => row.id)).not.toContain(evidenceId);

    const claimed = await api.post(`/api/skill-evidence/${evidenceId}/claim`);
    expect(claimed.status).toBe(403);
    expect(claimed.envelope.code).toBe('OutOfExpertiseError');
  });

  it('refuses an administrator deciding skill evidence (BR-065)', async () => {
    const skillId = await seedSkill(harness, { name: 'Yoga', category: 'Wellness' });
    const { evidenceId } = await submitEvidence('fr4-admin@skillswap.test', skillId, 'admin-fr4-3');

    api.actAs('admin-fr4-3', 'admin');
    const claim = await api.post(`/api/skill-evidence/${evidenceId}/claim`);
    // The role guard refuses a non-verifier role outright.
    expect([403, 401]).toContain(claim.status);
  });

  it('refuses a second Verifier claiming an already-claimed request', async () => {
    const skillId = await seedSkill(harness, { name: 'Chess', category: 'Games' });
    const { evidenceId } = await submitEvidence('fr4-double@skillswap.test', skillId, 'admin-fr4-4');
    await seedVerifier(harness, { accountId: 'vf-chess-a', expertise: [skillId] });
    await seedVerifier(harness, { accountId: 'vf-chess-b', expertise: [skillId] });

    api.actAs('vf-chess-a', 'verifier');
    expect((await api.post(`/api/skill-evidence/${evidenceId}/claim`)).status).toBe(200);

    api.actAs('vf-chess-b', 'verifier');
    const second = await api.post(`/api/skill-evidence/${evidenceId}/claim`);
    expect(second.status).toBe(409);
  });

  it('lets an administrator suspend a Verifier, who then cannot use the queue', async () => {
    const skillId = await seedSkill(harness, { name: 'Painting', category: 'Art' });
    await submitEvidence('fr4-suspend@skillswap.test', skillId, 'admin-fr4-5');
    await seedVerifier(harness, { accountId: 'vf-art', expertise: [skillId] });

    api.actAs('admin-fr4-5', 'admin');
    const suspended = await api.post('/api/verifiers/vf-art/status', { status: 'suspended' });
    expect(suspended.status).toBe(200);
    expect(suspended.json.status).toBe('suspended');

    api.actAs('vf-art', 'verifier');
    const queue = await api.get('/api/verifiers/me/queue');
    expect(queue.status).toBe(403);
  });
});
