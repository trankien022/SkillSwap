import { startHarness, type Harness } from './harness';
import { resetDatabase } from './support/db';
import { PostgresProcessedEventStore } from '../src/shared/messaging/processed-event-store';
import { ProjectTeacherTrustUseCase } from '../src/modules/live-class/internal/application/project-teacher-trust.use-case';
import { TEACHER_TRUST_WRITER, type TeacherTrustWriter } from '../src/modules/live-class/internal/application/port/out/teacher-trust';

jest.setTimeout(180_000);

/**
 * ADR-013 Amendment A (W2 C1, decided 2026-10-25): every event carries a per-aggregate
 * sequence, and a consumer that has already applied a higher one ignores a late arrival.
 *
 * Against the REAL stack, because the guarantee is made of three pieces a fake would not
 * exercise together: the relay stamps the number off the outbox row, the consumer reads it
 * off the envelope, and the consumer's own schema holds the watermark.
 *
 * The inversion is deliberate, and it is the case `occurredAt` cannot catch. The projection is
 * last-writer-wins by `occurredAt`, and these two events carry timestamps that agree with
 * their *publish* order — so a pure timestamp check would let the stale one win.
 */

const APPROVED_QUEUE = 'live-class.student-verification-approved';

let counter = 0;

/**
 * Real account ids are UUIDs in Postgres, and every consumer of these events writes them into
 * a uuid column. Seeded ids must look the same or an *unrelated* consumer dead-letters the
 * event on a cast error, and the test then proves nothing about ordering.
 */
function accountId(): string {
  counter += 1;
  return `7c1e0000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
}

function verificationId(): string {
  counter += 1;
  return `7c1e0001-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`;
}

describe('E2E: an out-of-order delivery converges on the newest sequence (W2 C1)', () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await startHarness();
    await resetDatabase(harness);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  async function seedOutboxRow(
    eventType: string,
    sequence: number | null,
    payload: Record<string, unknown>,
    createdAt: Date,
  ): Promise<string> {
    const rows = await harness.query<{ id: string }>(
      'live-class',
      `INSERT INTO outbox_messages ("event_type", "payload", "aggregate_id", "sequence", "created_at")
       VALUES ($1, $2::jsonb, $3, $4, $5) RETURNING "id"`,
      [eventType, JSON.stringify(payload), payload.accountId ?? null, sequence, createdAt],
    );
    return rows[0]!.id;
  }

  /** A payload that satisfies the canonical contract, so only ordering is under test. */
  function verificationPayload(
    account: string,
    status: 'pending' | 'approved' | 'rejected' | 'revoked',
    occurredAt: Date,
  ): Record<string, unknown> {
    return {
      verificationId: verificationId(),
      accountId: account,
      status,
      schoolName: 'FPT University',
      reason: status === 'pending' ? null : 'exercising the ordering guard',
      occurredAt: occurredAt.toISOString(),
    };
  }

  async function eventStatus(id: string): Promise<string | undefined> {
    const rows = await harness.query<{ status: string }>(
      'live-class',
      'SELECT "status" FROM outbox_messages WHERE "id" = $1',
      [id],
    );
    return rows[0]?.status;
  }

  async function waitFor(label: string, check: () => Promise<boolean>): Promise<void> {
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (await check()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`timed out waiting for ${label}`);
  }

  async function waitForPublished(id: string): Promise<void> {
    await waitFor(`outbox row ${id} published`, async () => (await eventStatus(id)) === 'PUBLISHED');
  }

  async function waitForProcessed(queue: string, eventId: string): Promise<void> {
    await waitFor(`event ${eventId} processed by ${queue}`, async () => {
      const rows = await harness.query<{ id: string }>(
        'live-class',
        `SELECT "id" FROM processed_events WHERE "id" = $1 AND "status" = 'DONE'`,
        [`${queue}:${eventId}`],
      );
      return rows.length > 0;
    });
  }

  async function verifiedOf(account: string): Promise<boolean | undefined> {
    const rows = await harness.query<{ verified: boolean }>(
      'live-class',
      'SELECT "verified" FROM teacher_verified WHERE "account_id" = $1',
      [account],
    );
    return rows[0]?.verified;
  }

  async function watermarkOf(
    queue: string,
    account: string,
  ): Promise<number | null | undefined> {
    const rows = await harness.query<{ sequence: number | null }>(
      'live-class',
      'SELECT "sequence" FROM processed_events WHERE "id" = $1',
      [`${queue}:seq:${account}`],
    );
    return rows[0]?.sequence;
  }

  it('applies the newest state even when the older event arrives last', async () => {
    const account = accountId();
    const base = Date.now();
    const rejectedQueue = 'live-class.student-verification-rejected';

    const payload = (
      status: 'pending' | 'approved' | 'rejected' | 'revoked',
      occurredAt: Date,
    ): Record<string, unknown> => ({
      verificationId: verificationId(),
      accountId: account,
      status,
      schoolName: 'FPT University',
      reason: status === 'pending' ? null : 'exercising the ordering guard',
      occurredAt: occurredAt.toISOString(),
    });

    // Both deliveries go to the same consumer queue. Sequence 2 says "rejected" and is written
    // to the outbox first, so the relay publishes it first; sequence 1 — an approval, produced
    // and stamped earlier — arrives second, last, and stale.
    //
    // `occurredAt` deliberately agrees with the sequence, so a timestamp comparison would keep
    // the newer row *by accident*. Making it disagree would test the projection's own guard
    // instead of the sequence, which is not what this suite is about.
    const newest = await seedOutboxRow(
      'student.verification.rejected',
      2,
      payload('rejected', new Date(base + 2_000)),
      new Date(base - 5_000),
    );
    const stale = await seedOutboxRow(
      'student.verification.approved',
      1,
      payload('approved', new Date(base)),
      new Date(base),
    );

    await waitForPublished(newest);
    await waitForPublished(stale);

    // Deliver both through ONE queue's consumer, in publish order, so the stale event is
    // provably handed to the guard *after* the newer one rather than merely arriving later on
    // the wire. (RabbitMQ has no ordering, which is exactly why the guard cannot depend on it.)
    //
    // A *fresh* store per delivery, so the guard is decided by the watermark row the previous
    // delivery committed rather than by this object's in-memory cache: the cache would hide a
    // broken read path, and a second consumer instance (or a restart) has no cache at all.
    const trust = harness.resolve<TeacherTrustWriter>(TEACHER_TRUST_WRITER);
    const project = new ProjectTeacherTrustUseCase(trust);
    const deliveries = [
      { id: newest, status: 'rejected' as const, occurredAt: new Date(base + 2_000), sequence: 2 },
      { id: stale, status: 'approved' as const, occurredAt: new Date(base), sequence: 1 },
    ];
    for (const delivery of deliveries) {
      const store = harness.resolve<PostgresProcessedEventStore>(PostgresProcessedEventStore);
      await store.runOnce(
        'live-class',
        rejectedQueue,
        delivery.id,
        () =>
          project.onVerification({
            verificationId: verificationId(),
            accountId: account,
            status: delivery.status,
            schoolName: 'FPT University',
            reason: null,
            occurredAt: delivery.occurredAt.toISOString(),
          }),
        { aggregateId: account, sequence: delivery.sequence },
      );
    }

    // The stale approval was applied last and must not have won.
    expect(await verifiedOf(account)).toBe(false);
    expect(await watermarkOf(rejectedQueue, account)).toBe(2);
  });

  it('lets a genuinely newer change through, so the guard is not a wall', async () => {
    const account = accountId();
    const now = Date.now();

    const first = await seedOutboxRow(
      'student.verification.approved',
      0,
      verificationPayload(account, 'approved', new Date(now - 2_000)),
      new Date(now - 2_000),
    );
    await waitForPublished(first);
    await waitForProcessed(APPROVED_QUEUE, first);
    expect(await verifiedOf(account)).toBe(true);

    const second = await seedOutboxRow(
      'student.verification.revoked',
      1,
      verificationPayload(account, 'revoked', new Date(now)),
      new Date(now),
    );
    await waitForPublished(second);
    await waitForProcessed('live-class.student-verification-revoked', second);

    expect(await verifiedOf(account)).toBe(false);
    expect(await watermarkOf('live-class.student-verification-revoked', account)).toBe(1);
  });

  it('still applies an unstamped event to an aggregate it has never seen', async () => {
    const account = accountId();

    // A row written before the column existed: no sequence at all. E8 requires such events to
    // stay deliverable — dropping historical rows while fixing a dropped-event bug would
    // defeat the purpose of the fix.
    const legacy = await seedOutboxRow(
      'student.verification.approved',
      null,
      verificationPayload(account, 'approved', new Date()),
      new Date(),
    );

    await waitForPublished(legacy);
    await waitForProcessed(APPROVED_QUEUE, legacy);

    expect(await verifiedOf(account)).toBe(true);
    // No watermark, because an unstamped event states no position.
    expect(await watermarkOf(APPROVED_QUEUE, account)).toBeUndefined();
  });

  it('keeps sequences independent per aggregate', async () => {
    // Two different accounts, each at sequence 0, delivered on two different queues. The
    // watermark is keyed per (queue, aggregate), so neither swallows the other; a single global
    // counter, or a watermark keyed only by queue, would drop one of them.
    const account = accountId();
    const otherAccount = accountId();
    const now = new Date();

    const forAccount = await seedOutboxRow(
      'student.verification.approved',
      0,
      verificationPayload(account, 'approved', now),
      now,
    );
    const forClass = await seedOutboxRow(
      'skill.evidence.approved',
      0,
      {
        evidenceId: verificationId(),
        profileSkillId: verificationId(),
        accountId: otherAccount,
        skillId: 'skill-guitar',
        version: 1,
        requestedLevel: 'advanced',
        status: 'approved',
        approvedLevel: 'advanced',
        reason: null,
        occurredAt: now.toISOString(),
      },
      now,
    );

    await waitForPublished(forAccount);
    await waitForPublished(forClass);
    await waitForProcessed(APPROVED_QUEUE, forAccount);
    await waitForProcessed('live-class.skill-evidence-approved', forClass);

    expect(await watermarkOf(APPROVED_QUEUE, account)).toBe(0);
    expect(await watermarkOf('live-class.skill-evidence-approved', otherAccount)).toBe(0);
    // And the second aggregate's event was actually applied, not merely recorded.
    const approval = await harness.query<{ approved_level: string }>(
      'live-class',
      'SELECT "approved_level" FROM teacher_skill_approval WHERE "account_id" = $1',
      [otherAccount],
    );
    expect(approval[0]?.approved_level).toBe('advanced');
  });

  it('leaves an event with no aggregate id deliverable instead of blocking it', async () => {
    // Operationally this is the payload shape every consumer would reject anyway (the contract
    // requires an aggregate id), so it cannot be produced through the outbox. What is under
    // test is the guard itself: given such a delivery, the consumer store must run the handler
    // and record no watermark, rather than compare a sequence it cannot place.
    const store = harness.resolve<PostgresProcessedEventStore>(PostgresProcessedEventStore);
    let handled = 0;

    await store.runOnce(
      'live-class',
      'live-class.test-no-aggregate',
      'event-without-an-aggregate',
      async () => {
        handled += 1;
      },
      { aggregateId: null, sequence: 7 },
    );

    expect(handled).toBe(1);
    const rows = await harness.query<{ id: string }>(
      'live-class',
      `SELECT "id" FROM processed_events WHERE "id" LIKE $1`,
      ['live-class.test-no-aggregate:seq:%'],
    );
    expect(rows).toEqual([]);
  });
});
