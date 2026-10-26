import { startHarness, type Harness } from './harness';
import { ApiClient, accountIdFromToken, waitFor } from './support/api-client';
import { resetDatabase, seedTeacherTrust, walletRow } from './support/db';
import { ClassReminderSweeper } from '../src/modules/live-class/internal/adapter/in/scheduler/class-reminder.sweeper';

jest.setTimeout(180_000);

/** SePay IPN body (ADR-033); the booking path needs a funded learner. */
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
 * FR-016 (W3): "class starting soon", against the REAL stack.
 *
 * The property cannot be proven with fakes alone. The window is evaluated in SQL, the "only once"
 * guarantee is a unique key competing between writers, and the visible result is an inbox row
 * produced by a consumer in another schema. A unit test can show each piece agrees with itself;
 * only this can show they compose.
 *
 * Time is moved by editing `starts_at`, never by sleeping. The API requires a class starting in the
 * future and a booking at least 24h before it, so each scenario is built legitimately and then aged
 * into its reminder window — exactly the state a real class reaches on its own.
 */
describe('E2E: class starting soon (FR-016 / W3)', () => {
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

  const minute = 60_000;

  interface Scenario {
    classId: string;
    teacherId: string;
    learnerId: string;
  }

  async function registerUser(email: string): Promise<string> {
    const res = await api.post('/api/auth/register', {
      email,
      displayName: 'Reminder User',
      password: 'reminder-password',
      role: 'user',
    });
    return accountIdFromToken(res.json.accessToken);
  }

  async function sweep(): Promise<void> {
    await harness.resolve<ClassReminderSweeper>(ClassReminderSweeper).sweep();
  }

  async function reminderEvents(
    classId: string,
  ): Promise<Array<{ event_type: string; payload: Record<string, unknown> }>> {
    return harness.query(
      'live-class',
      `SELECT "event_type", "payload" FROM outbox_messages
        WHERE "event_type" = 'class.starting.soon' AND "payload"->>'classId' = $1`,
      [classId],
    );
  }

  async function reminderRows(classId: string): Promise<Array<{ kind: string }>> {
    return harness.query('live-class', 'SELECT "kind" FROM class_reminders WHERE "class_id" = $1', [
      classId,
    ]);
  }

  /**
   * A published class with a confirmed booking, aged so it starts in `minutesFromNow`
   * (negative = already started).
   */
  async function bookedClass(
    label: string,
    minutesFromNow: number,
    /** W3 C2: a Pending booking has not settled, so that learner is not yet a party. */
    options: { confirm?: boolean } = {},
  ): Promise<Scenario> {
    const teacherId = await registerUser(`w3-teacher-${label}@skillswap.test`);
    const learnerId = await registerUser(`w3-learner-${label}@skillswap.test`);
    await seedTeacherTrust(harness, {
      teacherId,
      verified: true,
      approvedLevels: { 'skill-guitar': 'advanced' },
    });
    // AC-034: the learner needs an approved student verification before it may book at all.
    await seedTeacherTrust(harness, { teacherId: learnerId, verified: true });

    // Booked 48h out (the API's 24h lead time), then aged to the instant this test needs.
    const bookedFor = new Date(Date.now() + 48 * 60 * minute);

    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      description: `Reminder ${label}`,
      startsAt: bookedFor.toISOString(),
      durationMinutes: 60,
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
      idempotencyKey: `w3-${label}`,
    });
    expect(booked.status).toBe(201);
    const bookingId = booked.json.booking.bookingId as string;
    if (options.confirm !== false) {
      const confirmed = await api.post(`/api/classes/bookings/${bookingId}/confirm`);
      expect(confirmed.status).toBe(200);
      // Confirmation settles asynchronously; a Pending booking is not a party (W3 C2).
      await waitFor(async () => {
        const rows = await harness.query<{ state: string }>(
          'live-class',
          'SELECT "state" FROM bookings WHERE "id" = $1',
          [bookingId],
        );
        return rows[0]?.state === 'confirmed';
      });
    }

    // Move the class into (or out of) its window. The booking is aged with it so the 24h lead
    // time never becomes the thing under test.
    const startsAt = new Date(Date.now() + minutesFromNow * minute);
    await harness.query('live-class', 'UPDATE classes SET "starts_at" = $2 WHERE "id" = $1', [
      classId,
      startsAt.toISOString(),
    ]);
    await harness.query(
      'live-class',
      `UPDATE bookings SET "created_at" = now() - interval '3 days' WHERE "id" = $1`,
      [bookingId],
    );

    return { classId, teacherId, learnerId };
  }

  it('emits one reminder covering both parties when the window opens', async () => {
    // 13 minutes out: inside the 15-minute window that opened two minutes ago.
    const scenario = await bookedClass('inside', 13);

    await sweep();

    const events = await reminderEvents(scenario.classId);
    expect(events).toHaveLength(1);
    const participants = events[0].payload.participants as Array<{
      accountId: string;
      role: string;
    }>;    // W3 C4: both parties, with the role the copy depends on.
    expect(participants.map((p) => p.role).sort()).toEqual(['learner', 'teacher']);
    expect(participants.map((p) => p.accountId).sort()).toEqual(
      [scenario.learnerId, scenario.teacherId].sort(),
    );
  });

  it('emits nothing before the window opens or after the class has begun', async () => {
    const early = await bookedClass('early', 16);
    const started = await bookedClass('started', -1);

    await sweep();

    expect(await reminderEvents(early.classId)).toHaveLength(0);
    expect(await reminderEvents(started.classId)).toHaveLength(0);
    // Not even a claim: the sweep never selected them, so no row suggests a reminder happened.
    expect(await reminderRows(early.classId)).toEqual([]);
    expect(await reminderRows(started.classId)).toEqual([]);
  });

  it('reminds the Teacher but not a learner whose booking is still Pending (W3 C2)', async () => {
    // A Pending hold has not settled, so that learner is not yet a party. The reminder still goes
    // out -- the class is a fact regardless -- but the participants list must exclude them. If the
    // query joined bookings without the state filter, this learner would be told about a class
    // their hold may never pay for.
    const scenario = await bookedClass('pending', 10, { confirm: false });

    await sweep();

    const events = await reminderEvents(scenario.classId);
    expect(events).toHaveLength(1);
    const participants = events[0].payload.participants as Array<{ accountId: string; role: string }>;
    expect(participants.map((p) => p.role)).toEqual(['teacher']);
    expect(participants.some((p) => p.accountId === scenario.learnerId)).toBe(false);
  });

  it('emits nothing for a cancelled class, however close the start', async () => {    const scenario = await bookedClass('cancelled', 5);
    await harness.query('live-class', `UPDATE classes SET "state" = 'cancelled' WHERE "id" = $1`, [
      scenario.classId,
    ]);

    await sweep();

    expect(await reminderEvents(scenario.classId)).toHaveLength(0);
    expect(await reminderRows(scenario.classId)).toEqual([]);
  });

  it('is idempotent: a second sweep emits nothing and leaves one claim row', async () => {
    // The multi-instance property. Two API instances sweeping the same minute run the same scan;
    // the unique key decides which one wins, and only one may produce an event.
    const scenario = await bookedClass('twice', 10);

    await sweep();
    await sweep();

    expect(await reminderEvents(scenario.classId)).toHaveLength(1);
    expect(await reminderRows(scenario.classId)).toEqual([{ kind: 'starting_soon' }]);
  });

  it('reaches both inboxes exactly once', async () => {
    // The end-to-end claim: the outbox event is consumed and fans out to the inbox, which is the
    // only place a person can actually see the reminder.
    const scenario = await bookedClass('inbox', 8);

    await sweep();

    const countFor = async (accountId: string): Promise<number> => {
      const rows = await harness.query<{ count: string }>(
        'account-profile',
        `SELECT count(*)::text AS "count" FROM inbox_notifications
          WHERE "account_id" = $1 AND "type" = 'class_starting_soon'`,
        [accountId],
      );
      return Number(rows[0]?.count ?? '0');
    };

    await waitFor(async () => {
      const learner = await countFor(scenario.learnerId);
      const teacher = await countFor(scenario.teacherId);
      return learner === 1 && teacher === 1;
    });
    expect(await countFor(scenario.learnerId)).toBe(1);
    expect(await countFor(scenario.teacherId)).toBe(1);
  });
});
