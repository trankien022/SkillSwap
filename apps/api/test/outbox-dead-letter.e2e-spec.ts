import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase } from './support/db';

jest.setTimeout(60_000);

/**
 * FR-015 / ADR-013 Amendment A (W2 C3, decided 2026-10-25): the outbox dead-letter inbox.
 *
 * Against the REAL stack, because the property under test is cross-schema: the row is
 * written into `live_class.outbox_messages` and read through `admin-operation`, which is
 * exactly the merge the decision authorised. A unit test with a fake registry could not
 * catch a schema name written wrongly.
 *
 * The row is inserted directly rather than produced by a failing publish, because the
 * classified relay (Phase 1) deliberately no longer dead-letters transient failures — the
 * only remaining source of a `DEAD` row is a genuinely poisoned payload, which the seeded
 * row reproduces.
 */
describe('E2E: outbox dead-letter inbox (FR-015 / ADR-013 Amendment A)', () => {
  let harness: Harness;
  let api: ApiClient;

  const DEAD_ID = '0f000000-0000-4000-8000-000000000001';

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
      displayName: 'Dead Letter User',
      password: 'dead-letter-password',
      role: 'user',
    });
    return accountIdFromToken(res.json.accessToken);
  }

  async function seedDeadLetter(): Promise<void> {
    await harness.query(
      'live-class',
      `DELETE FROM outbox_messages WHERE "id" = $1`,
      [DEAD_ID],
    );
    await harness.query(
      'live-class',
      `INSERT INTO outbox_messages ("id", "event_type", "payload", "status", "attempts", "last_error")
       VALUES ($1, 'class.completed', $2::jsonb, 'DEAD', 5, 'payload failed schema validation')`,
      [DEAD_ID, JSON.stringify({ classId: 'cls-poisoned' })],
    );
  }

  async function statusOf(id: string): Promise<string | undefined> {
    const rows = await harness.query<{ status: string }>(
      'live-class',
      'SELECT "status" FROM outbox_messages WHERE "id" = $1',
      [id],
    );
    return rows[0]?.status;
  }

  it('refuses the inbox to a non-Administrator', async () => {
    const learnerId = await registerUser('fr15-deadletter-user@skillswap.test');
    api.actAs(learnerId, 'user');

    const res = await api.get('/api/operations/outbox-dead-letters');

    expect(res.status).toBe(403);
  });

  it('lists a dead letter with its event body and replays it exactly once, audited', async () => {
    await seedDeadLetter();
    const adminId = await registerUser('fr15-deadletter-admin@skillswap.test');
    api.actAs(adminId, 'admin');

    const listed = await api.get('/api/operations/outbox-dead-letters?module=live-class&limit=20');
    expect(listed.status).toBe(200);
    const entry = (listed.json.items as Array<Record<string, unknown>>).find(
      (item) => item.id === DEAD_ID,
    );
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      module: 'live-class',
      eventType: 'class.completed',
      attempts: 5,
      lastError: 'payload failed schema validation',
      payload: { classId: 'cls-poisoned' },
    });
    // The relay never burned it for a transient failure, so it is still terminal and visible.
    expect(await statusOf(DEAD_ID)).toBe('DEAD');

    const replayed = await api.post(
      `/api/operations/outbox-dead-letters/${DEAD_ID}/replay?module=live-class`,
    );
    expect(replayed.status).toBe(200);
    expect(replayed.json).toEqual({ replayed: true, status: 'PENDING' });
    expect(await statusOf(DEAD_ID)).toBe('PENDING');

    // A double click must not reset a row that is already in flight...
    const again = await api.post(
      `/api/operations/outbox-dead-letters/${DEAD_ID}/replay?module=live-class`,
    );
    expect(again.status).toBe(200);
    expect(again.json).toEqual({ replayed: false, status: 'PENDING' });

    // ...and must not fabricate a second audit row for work that did not happen.
    // Filtered only by the action: the audit projection is append-only and this suite
    // legitimately writes other replay rows, so the assertion is the *count over this target*.
    let audit: { items: Array<Record<string, unknown>> } | null = null;
    await waitFor(async () => {
      const res = await api.get('/api/audit-log?action=outbox.dead_letter.replayed&limit=100');
      if (res.status !== 200) {
        return null;
      }
      const rows = (res.json.items as Array<Record<string, unknown>>).filter(
        (item) => item.targetId === DEAD_ID,
      );
      if (rows.length === 0) {
        return null;
      }
      audit = { items: rows };
      return rows;
    });
    expect(audit!.items).toHaveLength(1);
    expect(audit!.items[0]).toMatchObject({
      actorId: adminId,
      action: 'outbox.dead_letter.replayed',
      targetType: 'outbox_message',
      targetId: DEAD_ID,
    });
  });

  it('rejects a replay without a module, because an id alone names no schema', async () => {
    const adminId = await registerUser('fr15-deadletter-admin2@skillswap.test');
    api.actAs(adminId, 'admin');

    const res = await api.post(`/api/operations/outbox-dead-letters/${DEAD_ID}/replay`);

    expect(res.status).toBe(400);
  });
});
