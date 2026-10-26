import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase, seedTeacherTrust, walletRow } from './support/db';
import { ClassCompletionSweeper } from '../src/modules/live-class/internal/adapter/in/scheduler/class-completion.sweeper';

jest.setTimeout(60_000);

// No default. The webhook refuses every request when its secret is empty, so a spec that
// quietly assumed one would be signing requests with a value the server never loaded -- which
// is exactly how these suites broke in CI while passing locally. A guess cannot fail in a way
// that says "the secret is missing", so there is no guess.
const WEBHOOK_SECRET = process.env.JITSI_WEBHOOK_SECRET ?? '';

/**
 * FR-020 / AC-035 (W1 C3a/C3b, decided 2026-10-25): a class completes early when the
 * room stays empty past the grace period.
 *
 * Against the REAL stack, because the property is a cross-boundary one: presence arrives
 * over HTTP, is stored in `live_class.class_presence`, is read back by the sweeper, and
 * the outcome is *money leaving pending*. A unit test with fakes could prove each link
 * but not that they compose on the real schema.
 *
 * The clock is moved by editing `starts_at` and writing presence rows with past
 * timestamps, rather than by sleeping five minutes.
 */
describe('E2E: room-idle completion (FR-020 / AC-035)', () => {
  let harness: Harness;
  let api: ApiClient;
  let learnerId: string;
  let teacherId: string;

  const hour = 60 * 60 * 1000;
  const minute = 60 * 1000;

  beforeAll(async () => {
    // Fail before the stack starts, with the actual reason. Without this the first webhook
    // returns 401 and the failure reads as "presence was rejected" rather than "no secret was
    // configured", which is the wrong problem to go debug.
    if (WEBHOOK_SECRET === '') {
      throw new Error(
        'JITSI_WEBHOOK_SECRET is not set. The presence webhook refuses every request when its ' +
          'secret is empty (ADR-020 Amendment A), so these specs cannot run without one. Set it ' +
          'in the environment (CI does this in .github/workflows/ci.yml) or in the repo-root .env.',
      );
    }
    harness = await startHarness();
    api = new ApiClient(harness.baseUrl);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  beforeEach(async () => {
    await resetDatabase(harness);
    const learner = await api.post('/api/auth/register', {
      email: 'idle-learner@skillswap.test',
      displayName: 'Idle Learner',
      password: 'idle-learner-password',
      role: 'user',
    });
    const teacher = await api.post('/api/auth/register', {
      email: 'idle-teacher@skillswap.test',
      displayName: 'Idle Teacher',
      password: 'idle-teacher-password',
      role: 'user',
    });
    expect(learner.status).toBe(201);
    expect(teacher.status).toBe(201);
    learnerId = accountIdFromToken(learner.json.accessToken);
    teacherId = accountIdFromToken(teacher.json.accessToken);
    await seedTeacherTrust(harness, {
      teacherId,
      verified: true,
      approvedLevels: { 'skill-guitar': 'advanced' },
    });
    // AC-034: booking is gated on an effective approved student verification, read from
    // the same `live_class.teacher_verified` projection, so the learner needs it too.
    await seedTeacherTrust(harness, { teacherId: learnerId, verified: true });
  });

  /** Publishes, books and confirms a class, leaving a paid booking in `confirmed`. */
  async function paidBooking(): Promise<{ classId: string; bookingId: string }> {
    api.actAs(learnerId);
    const start = await api.post('/api/wallet/top-ups', { amountVnd: 100_000 });
    expect(start.status).toBe(201);
    await api.post(
      '/api/wallet/top-ups/callback',
      sepayIpn(start.json.providerRef as string, 100_000),
    );
    await waitFor(async () => {
      const wallet = await walletRow(harness, learnerId);
      return wallet && wallet.availableCredits === 100 ? wallet : null;
    });

    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      description: 'Idle room class',
      startsAt: new Date(Date.now() + 48 * hour).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 2,
    });
    expect(created.status).toBe(201);
    const classId = created.json.id as string;

    api.actAs(learnerId);
    const booked = await api.post(`/api/classes/${classId}/bookings`, {
      idempotencyKey: `idle-key-${classId}`,
    });
    expect(booked.status).toBe(201);
    const bookingId = booked.json.booking.bookingId as string;
    const confirmed = await api.post(`/api/classes/bookings/${bookingId}/confirm`);
    expect(confirmed.status).toBe(200);

    await waitUntilConfirmed(bookingId);

    await waitFor(async () => {
      const teacher = await walletRow(harness, teacherId);
      return teacher && teacher.pendingCredits === 90 ? teacher : null;
    });
    return { classId, bookingId };
  }

  /**
   * Every presence check needs the learner's booking to be `confirmed` — that is what the
   * room-access rule calls joinable, and it is how the product models "they are a party".
   * Waiting on the booking row keeps the specs independent of how long settlement takes.
   */
  async function waitUntilConfirmed(bookingId: string): Promise<void> {
    await waitFor(async () => {
      const rows = await harness.query<{ state: string }>(
        'live-class',
        `SELECT "state" FROM bookings WHERE "id" = $1`,
        [bookingId],
      );
      return rows[0]?.state === 'confirmed' ? true : null;
    });
  }

  /** Moves the class to "started 20 minutes ago", still running. */
  async function startTwentyMinutesAgo(classId: string): Promise<void> {
    await harness.query('live-class', `UPDATE classes SET "state" = 'in_progress', "starts_at" = $1 WHERE "id" = $2`, [
      new Date(Date.now() - 20 * minute).toISOString(),
      classId,
    ]);
  }

  async function sweep(): Promise<void> {
    await harness.resolve<ClassCompletionSweeper>(ClassCompletionSweeper).sweep();
  }

  async function classState(classId: string): Promise<{ state: string; basis: string | null }> {
    const rows = await harness.query<{ state: string; completion_basis: string | null }>(
      'live-class',
      `SELECT "state", "completion_basis" FROM classes WHERE "id" = $1`,
      [classId],
    );
    return { state: rows[0]?.state ?? '', basis: rows[0]?.completion_basis ?? null };
  }

  function presence(classId: string, eventName: string, occupantId: string, at: Date) {
    api.actAs(null);
    return api.request(
      'POST',
      '/api/internal/jitsi/presence',
      {
        event_name: eventName,
        room: `skillswap-${classId}`,
        participant: { id: occupantId },
        timestamp: at.getTime(),
      },
      { headers: { 'x-jitsi-webhook-secret': WEBHOOK_SECRET } },
    );
  }

  it('completes a started class once everyone has been gone past the grace period, and pays out', async () => {
    const { classId } = await paidBooking();
    await startTwentyMinutesAgo(classId);

    const joined = new Date(Date.now() - 18 * minute);
    const left = new Date(Date.now() - 10 * minute); // 10 minutes ago > 5-minute grace
    const joinT = await presence(classId, 'participant-joined', teacherId, joined);
    const joinL = await presence(classId, 'participant-joined', learnerId, joined);
    const leftT = await presence(classId, 'participant-left', teacherId, left);
    const leftL = await presence(classId, 'participant-left', learnerId, left);
    expect([joinT.json, joinL.json, leftT.json, leftL.json]).toEqual([
      { accepted: true },
      { accepted: true },
      { accepted: true },
      { accepted: true },
    ]);

    await sweep();

    expect(await classState(classId)).toEqual({ state: 'completed', basis: 'room_idle' });
    const released = await waitFor(async () => {
      const teacher = await walletRow(harness, teacherId);
      return teacher && teacher.availableCredits === 90 ? teacher : null;
    });
    expect(released).toEqual({ availableCredits: 90, pendingCredits: 0 });
  });

  it('does not complete a started class while a participant is still in the room', async () => {
    const { classId } = await paidBooking();
    await startTwentyMinutesAgo(classId);

    const joined = new Date(Date.now() - 18 * minute);
    const tJoin = await presence(classId, 'participant-joined', teacherId, joined);
    const lJoin = await presence(classId, 'participant-joined', learnerId, joined);
    expect([tJoin.json, lJoin.json]).toEqual([{ accepted: true }, { accepted: true }]);
    // The Teacher steps out; the Learner stays. Both departures are distinct events.
    await presence(classId, 'participant-left', teacherId, new Date(Date.now() - 10 * minute));

    await sweep();

    expect(await classState(classId)).toMatchObject({ state: 'in_progress' });
    const teacher = await walletRow(harness, teacherId);
    expect(teacher?.pendingCredits).toBe(90);
  });

  it('does not complete early when everyone left but the grace period has not elapsed', async () => {
    const { classId } = await paidBooking();
    await startTwentyMinutesAgo(classId);

    const joined = new Date(Date.now() - 18 * minute);
    // Left only one minute ago: inside the five-minute grace window.
    const left = new Date(Date.now() - 1 * minute);
    await presence(classId, 'participant-joined', teacherId, joined);
    await presence(classId, 'participant-left', teacherId, left);

    await sweep();

    expect((await classState(classId)).state).toBe('in_progress');
  });

  it('never completes an unstarted class, however empty the room is', async () => {
    // The defect AC-035 exists to prevent: income released for a session that never ran.
    const { classId } = await paidBooking();
    // Still 48h in the future.
    await presence(classId, 'participant-joined', teacherId, new Date(Date.now() - minute));

    await sweep();

    expect(await classState(classId)).toMatchObject({ state: 'published' });
    const teacher = await walletRow(harness, teacherId);
    expect(teacher?.availableCredits).toBe(0);
  });

  it('changes nothing when a stranger joins and leaves a room they are not party to', async () => {
    const { classId } = await paidBooking();
    await startTwentyMinutesAgo(classId);

    const at = new Date(Date.now() - 10 * minute);
    const strangerJoin = await presence(classId, 'participant-joined', 'a1d00000-0000-4000-8000-000000000a04', at);
    expect(strangerJoin.status).toBe(200);
    expect(strangerJoin.json).toEqual({ accepted: false, reason: 'not_a_party' });
    const strangerLeave = await presence(classId, 'participant-left', 'a1d00000-0000-4000-8000-000000000a04', at);
    expect(strangerLeave.json).toEqual({ accepted: false, reason: 'not_a_party' });

    const rows = await harness.query<{ id: string }>(
      'live-class',
      `SELECT "id" FROM class_presence WHERE "class_id" = $1`,
      [classId],
    );
    expect(rows).toHaveLength(0);

    await sweep();
    // Presence is therefore "unknown", which must never complete a class early.
    expect((await classState(classId)).state).toBe('in_progress');
  });

  it('rejects a webhook without the shared secret', async () => {
    const { classId } = await paidBooking();
    await startTwentyMinutesAgo(classId);

    api.actAs(null);
    const missing = await api.request('POST', '/api/internal/jitsi/presence', {
      event_name: 'participant-joined',
      room: `skillswap-${classId}`,
      participant: { id: teacherId },
    });
    expect(missing.status).toBe(401);

    const wrong = await api.request(
      'POST',
      '/api/internal/jitsi/presence',
      { event_name: 'participant-joined', room: `skillswap-${classId}`, participant: { id: teacherId } },
      { headers: { 'x-jitsi-webhook-secret': 'not-the-secret' } },
    );
    expect(wrong.status).toBe(401);

    const rows = await harness.query<{ id: string }>(
      'live-class',
      `SELECT "id" FROM class_presence WHERE "class_id" = $1`,
      [classId],
    );
    expect(rows).toHaveLength(0);
  });

  it('refuses a no-show refund when the Teacher is recorded as having joined', async () => {
    // AC-024 used to accept `teacherJoinedAt: null` from the caller, so a Learner could
    // trigger a refund on their own word. The evidence now comes from class_presence.
    const { classId, bookingId } = await paidBooking();
    await startTwentyMinutesAgo(classId);
    await presence(classId, 'participant-joined', teacherId, new Date(Date.now() - 17 * minute));

    api.actAs(learnerId);
    const result = await api.post(`/api/classes/bookings/${bookingId}/no-show`);
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ cancelled: false });
  });

  it('still cancels for a real no-show when the Teacher never joined', async () => {
    const { classId, bookingId } = await paidBooking();
    // 20 minutes in, past the 15-minute window, and no Teacher presence at all.
    await startTwentyMinutesAgo(classId);
    await presence(classId, 'participant-joined', learnerId, new Date(Date.now() - 19 * minute));

    api.actAs(learnerId);
    const result = await api.post(`/api/classes/bookings/${bookingId}/no-show`);
    expect(result.json).toEqual({ cancelled: true });
  });
});

/** SePay Payment Gateway IPN shaped exactly like a live Sandbox delivery (ADR-033). */
function sepayIpn(providerRef: string, amountVnd: number): unknown {
  return {
    notification_type: 'ORDER_PAID',
    order: {
      order_invoice_number: providerRef,
      order_amount: `${amountVnd}.00`,
      order_id: `sepay-${providerRef}`,
    },
    transaction: {
      transaction_id: `txn-${providerRef}`,
      transaction_amount: `${amountVnd}.00`,
      transaction_date: new Date().toISOString(),
    },
  };
}
