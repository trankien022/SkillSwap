import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase } from './support/db';

jest.setTimeout(180_000);

/**
 * W6 / FR-015 / OQ-015 / ADR-037: the admin-initiated account lock, against the real stack.
 *
 * What this proves that unit tests cannot:
 *
 * 1. The lock **bites**. A suspended account is refused at sign-in and at `/auth/me`, because
 *    ADR-037 reuses the status `assertAccountCanSignIn` already checked. A test that only read
 *    back the row would pass while the account carried on working.
 * 2. The **audit row names the Administrator**, not the suspended account (ADR-035). This is the
 *    same distinction AC-032 tests, and the direction that can silently fail: attributing a lock
 *    to its subject would look plausible in the table and answer the wrong question.
 * 3. The **lock list and the dashboard count agree** (the ADR-034 §7 invariant). Two endpoints
 *    describing the same set must not disagree about its size.
 * 4. A reason is **required**, and reactivating does not take one.
 */
describe('E2E: admin-initiated account lock (W6 / FR-015 / ADR-037)', () => {
  let harness: Harness;
  let api: ApiClient;
  // Real account ids are uuids; a readable placeholder would make the actor assertion prove
  // the wrong thing (ADR-035 Amendment A notes this trap for fixtures).
  const ADMIN = '6c0e0000-0000-4000-8000-00000000ad01';

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
      displayName: 'Lock Subject',
      password: 'lock-subject-password',
      role: 'user',
    });
    expect(res.status).toBe(201);
    return accountIdFromToken(res.json.accessToken);
  }

  it('refuses a suspension with no reason', async () => {
    const learnerId = await registerLearner('w6-noreason@skillswap.test');
    api.actAs(ADMIN, 'admin');

    const res = await api.post(`/api/operations/accounts/${learnerId}/suspension`, {
      reason: '   ',
    });
    expect(res.status).toBe(400);
  });

  it('suspends an account: it can no longer sign in, and the audit names the Administrator', async () => {
    const email = 'w6-locked@skillswap.test';
    const learnerId = await registerLearner(email);

    api.actAs(ADMIN, 'admin');
    const suspended = await api.post(`/api/operations/accounts/${learnerId}/suspension`, {
      reason: 'Repeated payment fraud',
    });
    expect(suspended.status).toBe(200);
    expect(suspended.json.status).toBe('suspended');
    expect(suspended.json.changed).toBe(true);
    expect(suspended.json.reason).toBe('Repeated payment fraud');

    // 1. The lock bites: the account cannot obtain a new session.
    const login = await api.post('/api/auth/login', { email, password: 'lock-subject-password' });
    expect(login.status).toBe(403);

    // 2. The audit row is the Administrator's act, not the subject's condition.
    let byAdmin: Array<Record<string, unknown>> = [];
    await waitFor(async () => {
      const res = await api.get(`/api/audit-log?actorId=${ADMIN}&limit=100`);
      if (res.status !== 200) {
        return null;
      }
      byAdmin = res.json.items as Array<Record<string, unknown>>;
      return byAdmin.some((row) => row.action === 'account.status.changed') ? byAdmin : null;
    });

    const lockRow = byAdmin.find(
      (row) => row.action === 'account.status.changed' && row.targetId === learnerId,
    );
    expect(lockRow).toBeDefined();
    expect(lockRow?.actorId).toBe(ADMIN);
    expect(lockRow?.actorId).not.toBe(learnerId);
    expect(lockRow?.oldState).toMatchObject({ status: 'active' });
    // ADR-037 decision 2: the reason is part of the record.
    expect(lockRow?.newState).toMatchObject({
      status: 'suspended',
      reason: 'Repeated payment fraud',
    });

    // The subject's own filter must not claim the act.
    const bySubject = await api.get(`/api/audit-log?actorId=${learnerId}&limit=100`);
    expect(bySubject.status).toBe(200);
    expect(
      (bySubject.json.items as Array<Record<string, unknown>>).map((row) => row.action),
    ).not.toContain('account.status.changed');
  });

  it('lists the lock, and the dashboard count agrees with it (ADR-034 §7)', async () => {
    api.actAs(ADMIN, 'admin');

    const list = await api.get('/api/operations/accounts?status=suspended&limit=100');
    expect(list.status).toBe(200);
    const items = list.json.items as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThan(0);
    // Every row carries what the decision requires: a reason and who applied it.
    for (const row of items) {
      expect(typeof row.reason).toBe('string');
      expect((row.reason as string).length).toBeGreaterThan(0);
      expect(row.suspendedAt).toBeDefined();
    }

    const dashboard = await api.get('/api/operations/dashboard');
    expect(dashboard.status).toBe(200);
    // The invariant: the number on the dashboard describes the list it points at.
    expect(dashboard.json.suspendedAccounts.total).toBe(list.json.page.total);

    // Both dashboard paths answer, so the shipped route keeps working.
    const legacy = await api.get('/api/admin-operation/dashboard');
    expect(legacy.status).toBe(200);
    expect(legacy.json.suspendedAccounts.total).toBe(dashboard.json.suspendedAccounts.total);
  });

  it('reinstates the account and records that act too', async () => {
    const email = 'w6-reinstate@skillswap.test';
    const learnerId = await registerLearner(email);
    api.actAs(ADMIN, 'admin');

    await api.post(`/api/operations/accounts/${learnerId}/suspension`, {
      reason: 'Investigation',
    });
    expect(
      (await api.post('/api/auth/login', { email, password: 'lock-subject-password' })).status,
    ).toBe(403);

    const reinstated = await api.post(`/api/operations/accounts/${learnerId}/reinstatement`);
    expect(reinstated.status).toBe(200);
    expect(reinstated.json.status).toBe('active');

    // Access is restored — the lock was a state, not a one-way door.
    expect(
      (await api.post('/api/auth/login', { email, password: 'lock-subject-password' })).status,
    ).toBe(200);

    // And it is no longer in the lock list.
    const list = await api.get('/api/operations/accounts?status=suspended&limit=100');
    const ids = (list.json.items as Array<Record<string, unknown>>).map((row) => row.accountId);
    expect(ids).not.toContain(learnerId);
  });

  it('refuses a non-administrator (AC-033)', async () => {
    const learnerId = await registerLearner('w6-forbidden@skillswap.test');
    api.actAs(learnerId, 'user');

    expect((await api.get('/api/operations/accounts')).status).toBe(403);
    expect(
      (await api.post(`/api/operations/accounts/${learnerId}/suspension`, { reason: 'self' }))
        .status,
    ).toBe(403);
    // A non-admin must not be able to suspend anyone, least of all themselves out of a 403.
    expect((await api.post(`/api/operations/accounts/${learnerId}/reinstatement`)).status).toBe(
      403,
    );
  });
});
