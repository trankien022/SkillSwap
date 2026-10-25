import { startHarness, type Harness } from './harness';
import { ApiClient, accountIdFromToken, waitFor } from './support/api-client';
import { resetDatabase, seedTeacherTrust, walletRow } from './support/db';

jest.setTimeout(180_000);

/**
 * W4 Phase 0b (ADR-035): AC-032's actor filter, recorded as a failing property before it is fixed.
 *
 * This file is **skipped on purpose**. Its job is to put the "before" state on record without
 * breaking `pnpm verify`: ADR-034 §9 says the actor filter "matches only rows written without an
 * actor (i.e. every row it can write)", and this asserts the opposite of that, so it must be red
 * until Phase 2 and 3 land.
 *
 * It is deleted — not kept skipped — once the flow works; a permanently skipped test is a comment
 * that costs a test run.
 *
 * What it proves when enabled today: a Verifier approves evidence (a privileged act, audited by
 * ADR-034 §5), and the Administrator's actor filter returns **zero** rows for the Verifier who did
 * it. That is the AC-032 gap: an administrator cannot answer "what did this person do".
 */
describe.skip('E2E: an audited action is attributed to the account that performed it (W4 / AC-032)', () => {
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

  async function registerUser(email: string): Promise<string> {
    const res = await api.post('/api/auth/register', {
      email,
      displayName: 'Audit Actor',
      password: 'audit-actor-password',
      role: 'user',
    });
    return accountIdFromToken(res.json.accessToken);
  }

  it('returns the row to the actor filter once the actor travels with the event', async () => {
    const verifierId = await registerUser('w4-verifier@skillswap.test');
    const learnerId = await registerUser('w4-learner@skillswap.test');
    const adminId = await registerUser('w4-admin@skillswap.test');
    await seedTeacherTrust(harness, {
      teacherId: learnerId,
      verified: true,
      approvedLevels: { 'skill-guitar': 'advanced' },
    });

    // A learner submits evidence; a Verifier claims and approves it. Both are audited.
    api.actAs(learnerId);
    const submitted = await api.post('/api/skill-evidence', {
      skillId: 'skill-guitar',
      requestedLevel: 'advanced',
      evidenceType: 'certificate',
      documentRef: 'https://example.test/w4.pdf',
    });
    expect(submitted.status).toBe(201);
    const evidenceId = submitted.json.id as string;

    api.actAs(verifierId);
    const claimed = await api.post(`/api/skill-evidence/${evidenceId}/claim`);
    expect(claimed.status).toBe(200);
    const approved = await api.post(`/api/skill-evidence/${evidenceId}/decision`, {
      decision: 'approve',
      approvedLevel: 'advanced',
    });
    expect(approved.status).toBe(200);

    // The audit projection is a consumer, so the row lands after the event.
    api.actAs(adminId);
    let byVerifier: Array<Record<string, unknown>> = [];
    await waitFor(async () => {
      const res = await api.get(`/api/audit-log?actorId=${verifierId}&limit=100`);
      if (res.status !== 200) {
        return null;
      }
      byVerifier = res.json.items as Array<Record<string, unknown>>;
      return byVerifier.length > 0 ? byVerifier : null;
    });

    // Today this is empty: every audited event is mapped with actorId: null (ADR-034 §9).
    expect(byVerifier.map((row) => row.action)).toEqual(
      expect.arrayContaining(['skill.evidence.claimed', 'skill.evidence.approved']),
    );
    // And the learner, who did not perform the privileged act, has no rows.
    const learnerRows = await api.get(`/api/audit-log?actorId=${learnerId}&limit=100`);
    expect(learnerRows.json.items).toEqual([]);
    // The wallet is untouched by an audit question; asserted so the test cannot pass by accident
    // if the fixtures drift.
    expect(await walletRow(harness, learnerId)).toBeNull();
  });
});
