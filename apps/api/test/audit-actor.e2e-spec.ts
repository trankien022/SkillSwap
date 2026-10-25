import { startHarness, type Harness } from './harness';
import { ApiClient, accountIdFromToken, waitFor } from './support/api-client';
import { resetDatabase, seedSkill, seedVerifier, waitVerifiedStudent } from './support/db';

jest.setTimeout(180_000);

/**
 * W4 / ADR-035: AC-032's actor filter, against the real stack.
 *
 * What it proves: a Verifier claims and approves evidence (a privileged act, audited by ADR-034 §5),
 * and the Administrator's actor filter returns **exactly those rows** for the Verifier who did it.
 * Before ADR-035 was implemented this returned nothing, because every audited event was mapped with
 * `actorId: null` — an administrator could not answer "what did this person do".
 *
 * The negative half matters as much as the positive one: the learner who submitted the evidence
 * must NOT appear at the Verifier's id. A mapping that recorded the subject rather than the actor
 * would pass a naive version of this test and still be wrong.
 */
describe('E2E: an audited action is attributed to the account that performed it (W4 / AC-032)', () => {
  let harness: Harness;
  let api: ApiClient;
  // A real account id is a uuid, and the actor column validates like any other account id
  // (ADR-035). A readable placeholder here would make the run prove the wrong thing.
  const ADMIN = '7c0e0000-0000-4000-8000-00000000ad01';
  const VERIFIER = '7c0e0000-0000-4000-8000-00000000ff01';

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
      displayName: 'Audit Actor',
      password: 'audit-actor-password',
      role: 'user',
    });
    return accountIdFromToken(res.json.accessToken);
  }

  /** A learner must be a verified student before they may submit evidence (FR-002). */
  async function verifyStudent(learnerId: string): Promise<void> {
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
    api.actAs(ADMIN, 'admin');
    const decided = await api.post(`/api/student-verifications/${submitted.json.id}/decision`, {
      decision: 'approve',
    });
    expect(decided.status).toBe(200);
    await waitVerifiedStudent(harness, learnerId);
  }

  it('returns the rows to the actor filter, and only to the actor', async () => {
    const skillId = await seedSkill(harness, { name: 'Audit Guitar', category: 'Music' });
    const learnerId = await registerLearner('w4-learner@skillswap.test');
    const verifierId = VERIFIER;
    await verifyStudent(learnerId);
    await seedVerifier(harness, { accountId: verifierId, expertise: [skillId] });

    // The learner submits: an act by the learner, so the learner owns that row.
    api.actAs(learnerId, 'user');
    const submitted = await api.post('/api/skill-evidence', {
      skillId,
      requestedLevel: 'advanced',
      evidenceType: 'certificate',
      documentRef: 'docs/w4.pdf',
    });
    expect(submitted.status).toBe(201);
    const evidenceId = submitted.json.id as string;

    // The Verifier claims and approves: a privileged act by the Verifier.
    api.actAs(verifierId, 'verifier');
    expect((await api.post(`/api/skill-evidence/${evidenceId}/claim`)).status).toBe(200);
    const approved = await api.post(`/api/skill-evidence/${evidenceId}/decision`, {
      decision: 'approve',
      approvedLevel: 'advanced',
    });
    expect(approved.status).toBe(200);

    // The audit projection is a consumer, so the row lands after the event.
    api.actAs(ADMIN, 'admin');
    let byVerifier: Array<Record<string, unknown>> = [];
    await waitFor(async () => {
      const res = await api.get(`/api/audit-log?actorId=${verifierId}&limit=100`);
      if (res.status !== 200) {
        return null;
      }
      byVerifier = res.json.items as Array<Record<string, unknown>>;
      return byVerifier.length >= 2 ? byVerifier : null;
    });

    // Both privileged acts name the Verifier, which is the whole of AC-032.
    expect(byVerifier.map((row) => row.action)).toEqual(
      expect.arrayContaining(['skill.evidence.claimed', 'skill.evidence.approved']),
    );
    // Every row returned by the filter really carries that actor, not just the ones we listed.
    expect(new Set(byVerifier.map((row) => row.actorId))).toEqual(new Set([verifierId]));

    // The Verifier's filter must not include the learner's submission: submissions are not
    // privileged acts and are deliberately outside ADR-034 §5's table (only claims and decisions
    // are audited), so this asserts the separation in the direction that can actually fail.
    const learnerRows = await api.get(`/api/audit-log?actorId=${learnerId}&limit=100`);
    expect(learnerRows.status).toBe(200);
    const learnerActions = (learnerRows.json.items as Array<Record<string, unknown>>).map(
      (row) => row.action,
    );
    expect(learnerActions).not.toContain('skill.evidence.approved');
    expect(learnerActions).not.toContain('skill.evidence.claimed');
    // And nothing the Verifier did is attributed to the learner.
    expect(byVerifier.some((row) => row.actorId === learnerId)).toBe(false);
  });

  it('attributes an Administrator decision to the Administrator, not the student it is about', async () => {
    // The distinction that makes the field worth having: the subject of the act and the actor are
    // different people, and the filter must answer for the second.
    const learnerId = await registerLearner('w4-subject@skillswap.test');
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
    api.actAs(ADMIN, 'admin');
    const decided = await api.post(`/api/student-verifications/${submitted.json.id}/decision`, {
      decision: 'approve',
    });
    expect(decided.status).toBe(200);

    let byAdmin: Array<Record<string, unknown>> = [];
    await waitFor(async () => {
      const res = await api.get(`/api/audit-log?actorId=${ADMIN}&limit=100`);
      if (res.status !== 200) {
        return null;
      }
      byAdmin = res.json.items as Array<Record<string, unknown>>;
      return byAdmin.some((row) => row.action === 'student.verification.approved') ? byAdmin : null;
    });
    expect(byAdmin.some((row) => row.action === 'student.verification.approved')).toBe(true);

    const bySubject = await api.get(`/api/audit-log?actorId=${learnerId}&limit=100`);
    expect(
      (bySubject.json.items as Array<Record<string, unknown>>).map((row) => row.action),
    ).not.toContain('student.verification.approved');
  });
});
