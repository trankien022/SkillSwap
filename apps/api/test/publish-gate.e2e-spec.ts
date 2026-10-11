import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase, seedSkill, seedVerifier } from './support/db';

jest.setTimeout(60_000);

/**
 * FR-005 (ADR-024 extension) against the REAL stack: a class may be published only when
 * the Teacher is a verified student approved (at the required level) for every class skill.
 * The gate reads the event-fed `live-class` projection, so the suite drives the real
 * verification + evidence flows and waits for the projection to catch up.
 */
describe('E2E: publish gate (FR-005 / AC-002)', () => {
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
      displayName: 'Gate Learner',
      password: 'learner-password',
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
    await waitFor(async () => {
      api.actAs(learnerId, 'user');
      const me = await api.get('/api/auth/me');
      return me.json?.studentVerification?.status === 'approved' ? me : null;
    });
  }

  /** Drives submit → claim → approve of evidence for a skill, then waits for the projection. */
  async function approveSkill(ownerId: string, skillId: string, verifierId: string, level: string): Promise<void> {
    api.actAs(ownerId, 'user');
    const submitted = await api.post('/api/skill-evidence', {
      skillId,
      requestedLevel: level,
      evidenceType: 'certificate',
      documentRef: 'docs/cert.pdf',
    });
    api.actAs(verifierId, 'verifier');
    await api.post(`/api/skill-evidence/${submitted.json.id}/claim`);
    await api.post(`/api/skill-evidence/${submitted.json.id}/decision`, { decision: 'approve', approvedLevel: level });
  }

  function publishBody(skillIds: string[]) {
    return {
      skillIds,
      description: 'Gate test class',
      startsAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 1,
    };
  }

  /** Publishes, waiting for the projection to have caught up (else 403). */
  async function publishUntilAllowed(teacherId: string, skillIds: string[]) {
    return waitFor(async () => {
      api.actAs(teacherId, 'user');
      const res = await api.post('/api/classes', publishBody(skillIds));
      return res.status === 201 ? res : null;
    });
  }

  it('refuses an unverified teacher, then publishes once verified and approved', async () => {
    const skillId = await seedSkill(harness, { name: 'React', category: 'Programming' });
    const teacherId = await registerLearner('fr5-teacher@skillswap.test');

    // Unverified → 403.
    api.actAs(teacherId, 'user');
    const denied = await api.post('/api/classes', publishBody([skillId]));
    expect(denied.status).toBe(403);

    // Verify + approve the skill, then publish succeeds.
    await verifyStudent(teacherId, 'admin-fr5-1');
    await waitVerified(teacherId);
    await seedVerifier(harness, { accountId: 'vf-react', expertise: [skillId] });
    await approveSkill(teacherId, skillId, 'vf-react', 'intermediate');

    const published = await publishUntilAllowed(teacherId, [skillId]);
    expect(published.status).toBe(201);
    expect(published.json.state).toBe('published');
  });

  it('refuses a class whose skill the teacher is not approved for (SR-BR-002)', async () => {
    const approvedSkill = await seedSkill(harness, { name: 'Guitar', category: 'Music' });
    const otherSkill = await seedSkill(harness, { name: 'Piano', category: 'Music' });
    const teacherId = await registerLearner('fr5-partial@skillswap.test');
    await verifyStudent(teacherId, 'admin-fr5-2');
    await waitVerified(teacherId);
    await seedVerifier(harness, { accountId: 'vf-guitar', expertise: [approvedSkill] });
    await approveSkill(teacherId, approvedSkill, 'vf-guitar', 'advanced');

    // Wait for the approved skill to project, then require BOTH skills.
    await waitFor(async () => {
      api.actAs(teacherId, 'user');
      const ok = await api.post('/api/classes', publishBody([approvedSkill]));
      return ok.status === 201 ? ok : null;
    });

    api.actAs(teacherId, 'user');
    const refused = await api.post('/api/classes', publishBody([approvedSkill, otherSkill]));
    expect(refused.status).toBe(403);
    expect(refused.json.error).toBe('SkillNotApprovedError');
  });

  it('demotes publish rights when student verification is revoked (FR-019)', async () => {
    const skillId = await seedSkill(harness, { name: 'Chess', category: 'Games' });
    const teacherId = await registerLearner('fr5-revoked@skillswap.test');
    await verifyStudent(teacherId, 'admin-fr5-3');
    await waitVerified(teacherId);
    await seedVerifier(harness, { accountId: 'vf-chess', expertise: [skillId] });
    await approveSkill(teacherId, skillId, 'vf-chess', 'intermediate');
    await publishUntilAllowed(teacherId, [skillId]);

    // Revoke the student verification; the projection demotes publish rights.
    const verificationId = (await (async () => {
      api.actAs(teacherId, 'user');
      return api.get('/api/student-verifications/me');
    })()).json.id as string;
    api.actAs('admin-fr5-3', 'admin');
    await api.post(`/api/student-verifications/${verificationId}/revocation`, { reason: 'fake document' });

    await waitFor(async () => {
      api.actAs(teacherId, 'user');
      const res = await api.post('/api/classes', publishBody([skillId]));
      return res.status === 403 ? res : null;
    });
  });
});
