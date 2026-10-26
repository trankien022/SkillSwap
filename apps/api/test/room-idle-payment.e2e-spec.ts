import { startHarness, type Harness } from './harness';
import { ApiClient, accountIdFromToken, waitFor } from './support/api-client';
import { resetDatabase, seedTeacherTrust, walletRow } from './support/db';
import { ClassCompletionSweeper } from '../src/modules/live-class/internal/adapter/in/scheduler/class-completion.sweeper';

jest.setTimeout(180_000);

/** SePay IPN body (ADR-033), as the live gateway delivers it. */
function sepayIpn(invoiceNumber: string, amountVnd: number): Record<string, unknown> {
  return {
    timestamp: Math.floor(Date.now() / 1000),
    notification_type: 'ORDER_PAID',
    order: {
      order_id: `PAY-${invoiceNumber}`,
      order_status: 'CAPTURED',
      order_currency: 'VND',
      order_amount: `${amountVnd}.00`,
      order_invoice_number: invoiceNumber,
      order_description: `SkillSwap wallet top-up ${invoiceNumber}`,
      custom_data: [],
    },
    transaction: {
      payment_method: 'BANK_TRANSFER',
      transaction_id: `txn-${invoiceNumber}`,
      transaction_type: 'PAYMENT',
      transaction_status: 'APPROVED',
      transaction_amount: String(amountVnd),
      transaction_currency: 'VND',
      transaction_date: '2026-10-14 09:30:00',
    },
    customer: null,
    agreement: null,
  };
}

/**
 * AC-035 (W1 C3a/C3b): a class completes when the Jitsi room has stood empty past the grace
 * period, and the Teacher is paid exactly as at the scheduled end.
 *
 * Against the REAL stack (Postgres + RabbitMQ), because the property is a conversation between
 * three tables in two schemas: presence rows written through the webhook, the class row moved
 * by the completion sweep, and the Teacher's income released by the wallet after it consumes
 * `class.completed`. A unit test with fakes can show the rule; only this can show the money.
 */

const GRACE_MS = 5 * 60 * 1000;

describe('E2E: an idle room completes the class and pays the Teacher (AC-035)', () => {
  let harness: Harness;
  let api: ApiClient;
  let secret: string;

  beforeAll(async () => {
    harness = await startHarness();
    api = new ApiClient(harness.baseUrl);
    secret = process.env.JITSI_WEBHOOK_SECRET ?? '';
    // Same rule as room-idle.e2e-spec.ts: no guessed secret. An empty one is a configuration
    // error, and saying so beats nine confusing 401s.
    if (secret === '') {
      throw new Error(
        'JITSI_WEBHOOK_SECRET is not set. The presence webhook refuses every request when its ' +
          'secret is empty (ADR-020 Amendment A). Set it in the environment (CI does this in ' +
          '.github/workflows/ci.yml) or in the repo-root .env.',
      );
    }
    await resetDatabase(harness);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  interface Scenario {
    classId: string;
    teacherId: string;
    learnerId: string;
    bookingId: string;
    room: string;
  }

  async function registerUser(email: string): Promise<string> {
    const res = await api.post('/api/auth/register', {
      email,
      displayName: 'Idle Room User',
      password: 'idle-room-password',
      role: 'user',
    });
    return accountIdFromToken(res.json.accessToken);
  }

  async function postPresence(
    body: unknown,
    headerSecret: string | null = secret,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await fetch(`${harness.baseUrl}/api/internal/jitsi/presence`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(headerSecret === null ? {} : { 'x-jitsi-webhook-secret': headerSecret }),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text === '' ? {} : (JSON.parse(text) as Record<string, unknown>);
    } catch {
      parsed = { raw: text };
    }
    // The API wraps every response in { success, data, ... }; the payload is under `data`.
    const data = (parsed.data ?? parsed) as Record<string, unknown>;
    return { status: response.status, body: data };
  }

  function joinEvent(
    room: string,
    accountId: string,
    event: 'joined' | 'left' = 'joined',
  ): Record<string, unknown> {
    // The shape Jitsi's `event_sync` module posts (see presenceWebhookSchema).
    return {
      event_name: event === 'joined' ? 'participant-joined' : 'participant-left',
      room,
      participant: { id: accountId },
      timestamp: Date.now(),
    };
  }

  /**
   * A class with a confirmed booking that is now in progress.
   *
   * The API only accepts a class starting in the future (and a booking at least 24h before it),
   * so the scenario is built as a legitimate future booking and then aged: `starts_at` is moved
   * into the past while the booking stays confirmed. That is exactly the state a real class is
   * in half an hour after it began — no rule is bypassed to create it.
   *
   * `startedMinutesAgo` may be negative, which leaves the class in the future.
   *
   * The booking is aged with the class. The 24h lead time would otherwise leave every join on a
   * class booked 48h out depending on when the test runs, which is a flake, not a scenario.
   */
  async function bookClassInProgress(label: string, startedMinutesAgo: number): Promise<Scenario> {
    const teacherId = await registerUser(`ac035-teacher-${label}@skillswap.test`);
    const learnerId = await registerUser(`ac035-learner-${label}@skillswap.test`);
    await seedTeacherTrust(harness, {
      teacherId,
      verified: true,
      approvedLevels: { 'skill-guitar': 'advanced' },
    });
    // AC-034: the learner must also hold an approved student verification to book at all.
    await seedTeacherTrust(harness, { teacherId: learnerId, verified: true });

    // Booked 48h out, then aged to where the test needs it.
    const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      description: `Idle room ${label}`,
      startsAt: startsAt.toISOString(),
      durationMinutes: 120,
      priceCredits: 50,
      capacity: 1,
    });
    expect(created.status).toBe(201);
    const classId = created.json.id as string;

    api.actAs(learnerId);
    const topUp = await api.post('/api/wallet/top-ups', { amountVnd: 100_000 });
    expect(topUp.status).toBe(201);
    const paid = await api.post(
      '/api/wallet/top-ups/callback',
      sepayIpn(topUp.json.providerRef as string, 100_000),
    );
    expect(paid.status).toBe(200);
    await waitFor(async () => {
      const row = await walletRow(harness, learnerId);
      return row !== null && row.availableCredits >= 100;
    });

    const booked = await api.post(`/api/classes/${classId}/bookings`, {
      idempotencyKey: `ac035-${label}`,
    });
    expect(booked.status).toBe(201);
    const bookingId = booked.json.booking.bookingId as string;

    // The booking starts `pending` and only becomes `confirmed` when the Learner confirms it,
    // which is also what releases the hold. Presence admission reads `confirmed` bookings (a
    // pending one is not yet a party), so the confirmation has to have landed before any join.
    const confirmed = await api.post(`/api/classes/bookings/${bookingId}/confirm`);
    expect(confirmed.status).toBe(200);
    await waitFor(async () => {
      const rows = await harness.query<{ state: string }>(
        'live-class',
        'SELECT "state" FROM bookings WHERE "id" = $1',
        [bookingId],
      );
      return rows[0]?.state === 'confirmed';
    });

    // Settlement is asynchronous (outbox → wallet consumer), so wait for the Teacher's hold:
    // 50 credits at a 10% platform fee is 45.
    await waitFor(async () => {
      const teacher = await walletRow(harness, teacherId);
      return teacher !== null && teacher.pendingCredits === 45;
    });

    // Age the class to the point the test needs. The sweep treats a class whose window contains
    // `now` as in progress (see ClassCompletionSweeper).
    const agedStart = new Date(Date.now() - startedMinutesAgo * 60_000);
    await harness.query(
      'live-class',
      'UPDATE classes SET "starts_at" = $2 WHERE "id" = $1',
      [classId, agedStart.toISOString()],
    );
    // And age the booking's own marker if it has one, so the joins below do not depend on the
    // 24h lead time being already past in wall-clock terms.
    await harness.query(
      'live-class',
      `UPDATE bookings SET "created_at" = now() - interval '2 days'
        WHERE "id" = $1 AND "created_at" > now()`,
      [bookingId],
    );

    return {
      classId,
      teacherId,
      learnerId,
      bookingId,
      room: `skillswap-${classId}`,
    };
  }

  async function classState(classId: string): Promise<{ state: string; basis: string | null } | undefined> {
    const rows = await harness.query<{ state: string; completion_basis: string | null }>(
      'live-class',
      `SELECT CASE WHEN "state" IN ('published', 'full') THEN 'in_progress' ELSE "state" END AS "state",
              "completion_basis"
         FROM classes WHERE "id" = $1`,
      [classId],
    );
    return rows[0] === undefined
      ? undefined
      : { state: rows[0].state, basis: rows[0].completion_basis };
  }

  /** Runs the completion sweep the scheduler runs, so the test does not wait for a timer. */
  async function sweep(): Promise<void> {
    const sweeper = harness.resolve<ClassCompletionSweeper>(ClassCompletionSweeper);
    await sweeper.sweep();
  }

  /**
   * Moves every departed session past the grace period, and asserts one was moved.
   *
   * Both halves matter. Without the move the sweep sees a room that emptied a moment ago and
   * does nothing for a reason unrelated to the rule; without the count, a mis-keyed WHERE silently
   * backdates nothing and the test passes on the wrong behaviour — which is exactly how the
   * "somebody is still in the room" case first looked green.
   */
  async function backdateDepartures(classId: string): Promise<void> {
    const rows = await harness.query<{ id: string }>(
      'live-class',
      `UPDATE class_presence SET "left_at" = now() - ($2::int * interval '1 millisecond')
        WHERE "class_id" = $1 AND "left_at" IS NOT NULL
        RETURNING "id"`,
      [classId, GRACE_MS + 60_000],
    );
    expect(rows.length).toBeGreaterThan(0);
  }

  it('completes with basis room_idle once everyone has left for the grace period', async () => {
    const scenario = await bookClassInProgress('idle', 30);

    // Both parties join, then leave, and the last departure is older than the grace period.
    expect((await postPresence(joinEvent(scenario.room, scenario.teacherId, 'joined'))).body).toMatchObject({ accepted: true });
    expect((await postPresence(joinEvent(scenario.room, scenario.learnerId, 'joined'))).body).toMatchObject({ accepted: true });
    expect((await postPresence(joinEvent(scenario.room, scenario.teacherId, 'left'))).body).toMatchObject({ accepted: true });
    expect((await postPresence(joinEvent(scenario.room, scenario.learnerId, 'left'))).body).toMatchObject({ accepted: true });

    // Backdate the departures past the grace period: the sweep reads the clock, not the test.
    await backdateDepartures(scenario.classId);

    await sweep();

    expect(await classState(scenario.classId)).toEqual({ state: 'completed', basis: 'room_idle' });

    // The point of completing is paying the Teacher: `class.completed` must reach the wallet and
    // move the held income out of pending.
    await waitFor(async () => {
      const teacher = await walletRow(harness, scenario.teacherId);
      return teacher !== null && teacher.pendingCredits === 0 && teacher.availableCredits > 0;
    });
    const teacher = await walletRow(harness, scenario.teacherId);
    // 50 credits at a 10% platform fee: the Teacher keeps 45.
    expect(teacher?.availableCredits).toBe(45);
    expect(teacher?.pendingCredits).toBe(0);
  });

  it('does not complete while somebody is still in the room', async () => {
    const scenario = await bookClassInProgress('occupied', 30);

    expect((await postPresence(joinEvent(scenario.room, scenario.teacherId, 'joined'))).body).toMatchObject({ accepted: true });
    expect((await postPresence(joinEvent(scenario.room, scenario.learnerId, 'joined'))).body).toMatchObject({ accepted: true });
    expect((await postPresence(joinEvent(scenario.room, scenario.teacherId, 'left'))).body).toMatchObject({ accepted: true });

    await backdateDepartures(scenario.classId);
    // The Teacher's left marker is backdated 6 minutes; the learner's departure is set to 4
    // minutes ago, which is inside the 5-minute grace. So nobody is still in the room *and* the
    // room has not yet stood empty long enough — either condition alone would be a different test.
    await harness.query(
      'live-class',
      `UPDATE class_presence SET "left_at" = now() - interval '4 minutes'
        WHERE "class_id" = $1 AND "account_id" = $2`,
      [scenario.classId, scenario.learnerId],
    );
    const windows = await harness.query<{ account_id: string; seconds: number }>(
      'live-class',
      `SELECT "account_id", EXTRACT(EPOCH FROM (now() - "left_at"))::int AS "seconds"
         FROM class_presence WHERE "class_id" = $1 ORDER BY "account_id"`,
      [scenario.classId],
    );
    expect(windows.map((row) => row.account_id).sort()).toEqual(
      [scenario.teacherId, scenario.learnerId].sort(),
    );

    await sweep();

    // Everyone has left, but not for long enough: an empty room is not yet an abandoned one.
    expect(await classState(scenario.classId)).toEqual({ state: 'in_progress', basis: null });
  });

  it('does not complete during the grace period', async () => {
    const scenario = await bookClassInProgress('grace', 30);

    expect((await postPresence(joinEvent(scenario.room, scenario.teacherId, 'joined'))).body).toMatchObject({ accepted: true });
    expect((await postPresence(joinEvent(scenario.room, scenario.teacherId, 'left'))).body).toMatchObject({ accepted: true });

    // Everyone has left, but only just: this is the state the grace period exists for.
    await sweep();

    expect(await classState(scenario.classId)).toEqual({ state: 'in_progress', basis: null });
  });

  it('does not complete a class that has not started, however empty the room is', async () => {
    // Negative: the class is left in the future. Its room may already be "empty" — people can
    // open the link early — but an unstarted class must never be closed by any path.
    const scenario = await bookClassInProgress('unstarted', -60);

    expect((await postPresence(joinEvent(scenario.room, scenario.teacherId, 'joined'))).body).toMatchObject({ accepted: true });
    expect((await postPresence(joinEvent(scenario.room, scenario.teacherId, 'left'))).body).toMatchObject({ accepted: true });
    await backdateDepartures(scenario.classId);

    await sweep();

    expect(await classState(scenario.classId)).toEqual({ state: 'in_progress', basis: null });
  });

  it('treats silence as unknown, not empty, so a dead feed never ends a live class', async () => {
    const scenario = await bookClassInProgress('silence', 30);

    // No presence rows at all: the webhook has never reached us for this class.
    await sweep();

    expect(await classState(scenario.classId)).toEqual({ state: 'in_progress', basis: null });
  });

  it('ignores a stranger who guesses the room name', async () => {
    const scenario = await bookClassInProgress('stranger', 30);
    const stranger = await registerUser('ac035-stranger@skillswap.test');

    const joined = await postPresence(joinEvent(scenario.room, stranger, 'joined'));
    expect(joined.status).toBe(200);
    // A webhook is always acknowledged, but nothing is recorded for a non-party.
    expect(joined.body).toMatchObject({ accepted: false, reason: 'not_a_party' });

    const rows = await harness.query<{ id: string }>(
      'live-class',
      'SELECT "id" FROM class_presence WHERE "class_id" = $1',
      [scenario.classId],
    );
    expect(rows).toEqual([]);

    // And a stranger's departure cannot be the event that completes the class either: nothing
    // was recorded for them, so the class still has no presence at all.
    expect((await postPresence(joinEvent(scenario.room, stranger, 'left'))).body).toMatchObject({
      accepted: false,
      reason: 'not_a_party',
    });
    await sweep();
    expect(await classState(scenario.classId)).toEqual({ state: 'in_progress', basis: null });
  });

  it('refuses a webhook that does not present the configured secret', async () => {
    const scenario = await bookClassInProgress('nosecret', 30);

    // No header at all, and a wrong secret: both are refused before anything is written. The
    // endpoint is authenticated by a shared secret rather than by source IP (ADR-020 Amd A), so
    // this is the only thing standing between a stranger and the presence feed.
    expect((await postPresence(joinEvent(scenario.room, scenario.teacherId, 'joined'), null)).status).toBe(401);
    expect(
      (await postPresence(joinEvent(scenario.room, scenario.teacherId, 'joined'), 'not-the-secret')).status,
    ).toBe(401);

    const rows = await harness.query<{ id: string }>(
      'live-class',
      'SELECT "id" FROM class_presence WHERE "class_id" = $1',
      [scenario.classId],
    );
    expect(rows).toEqual([]);
  });

  /**
   * FR-016 / W9 R4: a settled top-up announces itself.
   *
   * The W9 trace walkthrough found this missing: a real top-up wrote its ledger row and moved the
   * balance, then stopped — no outbox row, so `account-profile.notification-wallet-completed` never
   * fired and a learner's money arrived silently. The booking path had the event all along, which
   * is why nothing caught it: every test that looked at settlement looked at the *booking*.
   */
  it('emits wallet.transaction.completed for a settled top-up', async () => {
    const learnerId = await registerUser('w9-trace-topup@skillswap.test');

    api.actAs(learnerId);
    const topUp = await api.post('/api/wallet/top-ups', { amountVnd: 50_000 });
    expect(topUp.status).toBe(201);
    const providerRef = topUp.json.providerRef as string;

    expect((await api.post('/api/wallet/top-ups/callback', sepayIpn(providerRef, 50_000))).status).toBe(200);

    const ledger = await harness.query<{ id: string; trace_id: string }>(
      'wallet-ledger',
      `SELECT "id", "trace_id" FROM ledger_entries
        WHERE "entry_type" = 'top_up' AND "owner_id" = $1`,
      [learnerId],
    );
    expect(ledger).toHaveLength(1);

    const outbox = await harness.query<{ event_type: string; payload: Record<string, unknown> }>(
      'wallet-ledger',
      `SELECT "event_type", "payload" FROM outbox_messages
        WHERE "payload"->>'accountId' = $1`,
      [learnerId],
    );
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.event_type).toBe('wallet.transaction.completed');
    // The event's transaction id is the ledger id — the durable identity a consumer can follow
    // back to the money it was told about.
    expect(outbox[0]?.payload.type).toBe('top_up');
    expect(outbox[0]?.payload.transactionId).toBe(ledger[0]?.id);
    expect(outbox[0]?.payload.amountCredits).toBe(50);
    // ADR-035: the beneficiary is the learner, the actor is the system (a SePay IPN acted).
    expect(outbox[0]?.payload.accountId).toBe(learnerId);
    expect(outbox[0]?.payload.actorId).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('stays silent on a replayed IPN, so the learner is notified once', async () => {
    const learnerId = await registerUser('w9-trace-replay@skillswap.test');

    api.actAs(learnerId);
    const topUp = await api.post('/api/wallet/top-ups', { amountVnd: 50_000 });
    const providerRef = topUp.json.providerRef as string;
    const body = sepayIpn(providerRef, 50_000);

    expect((await api.post('/api/wallet/top-ups/callback', body)).status).toBe(200);
    // SePay retries. A second acknowledgement must not credit twice *or* announce twice.
    expect((await api.post('/api/wallet/top-ups/callback', body)).status).toBe(200);

    const outbox = await harness.query<{ id: string }>(
      'wallet-ledger',
      `SELECT "id" FROM outbox_messages WHERE "payload"->>'accountId' = $1`,
      [learnerId],
    );
    expect(outbox).toHaveLength(1);

    const ledger = await harness.query<{ id: string }>(
      'wallet-ledger',
      `SELECT "id" FROM ledger_entries WHERE "entry_type" = 'top_up' AND "owner_id" = $1`,
      [learnerId],
    );
    expect(ledger).toHaveLength(1);
  });
});
