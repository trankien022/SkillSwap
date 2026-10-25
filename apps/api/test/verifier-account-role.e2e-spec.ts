import { startHarness, type Harness } from './harness';
import { ApiClient } from './support/api-client';
import { resetDatabase, seedSkill, seedVerifierAccount } from './support/db';

jest.setTimeout(60_000);

/**
 * FR-001 / FR-004 / ADR-029 against the REAL stack: `verifier` is a provisioned
 * account role. Public registration cannot mint it (nor `admin`); a provisioned
 * verifier account is accepted on verifier routes, and a non-verifier is refused.
 */
describe('E2E: verifier is a provisioned account role (ADR-029)', () => {
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

  it('refuses to self-register an admin or verifier', async () => {
    const admin = await api.post('/api/auth/register', {
      email: 'self-admin@skillswap.test',
      displayName: 'Self Admin',
      password: 'password-1',
      role: 'admin',
    });
    expect(admin.status).toBe(400);

    const verifier = await api.post('/api/auth/register', {
      email: 'self-verifier@skillswap.test',
      displayName: 'Self Verifier',
      password: 'password-1',
      role: 'verifier',
    });
    expect(verifier.status).toBe(400);

    // A learner still registers fine.
    const learner = await api.post('/api/auth/register', {
      email: 'self-learner@skillswap.test',
      displayName: 'Self Learner',
      password: 'password-1',
    });
    expect(learner.status).toBe(201);
  });

  it('accepts a provisioned verifier account on verifier routes, and refuses others', async () => {
    const skillId = await seedSkill(harness, { name: 'Kotlin', category: 'Programming' });
    const verifierId = await seedVerifierAccount(harness, {
      email: 'provisioned-verifier@skillswap.test',
      expertise: [skillId],
    });

    // The provisioned account carries role=verifier in the account model.
    const rows = await harness.query<{ role: string }>(
      'account-profile',
      'SELECT "role" FROM accounts WHERE "id" = $1',
      [verifierId],
    );
    expect(rows[0]?.role).toBe('verifier');

    // It is accepted on a verifier-guarded route.
    api.actAs(verifierId, 'verifier');
    const queue = await api.get('/api/verifiers/me/queue');
    expect(queue.status).toBe(200);

    // A learner identity is refused on the same route.
    api.actAs('a1d00000-0000-4000-8000-000000000a0a', 'user');
    const denied = await api.get('/api/verifiers/me/queue');
    expect(denied.status).toBe(403);
  });
});
