import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase, seedTeacherTrust, walletRow } from './support/db';
import { PendingHoldSweeper } from '../src/modules/live-class/internal/adapter/in/scheduler/pending-hold.sweeper';
import { ClassCompletionSweeper } from '../src/modules/live-class/internal/adapter/in/scheduler/class-completion.sweeper';

jest.setTimeout(60_000);

/**
 * End-to-end booking flow against REAL Postgres and REAL RabbitMQ (docker).
 * Payment is the SePay Payment Gateway (ADR-033): the specs post an IPN body
 * directly, and the harness replaces the outbound checkout redirect with a stub,
 * so no live call to SePay is made. Events cross module boundaries
 * through the outbox relay + consumer, exactly as in production, so assertions
 * poll for the downstream effect rather than reading a synchronous return value.
 *
 * Requires: `docker compose up -d postgres rabbitmq` and `pnpm db:migrate`.
 */
describe('E2E: book → settle → room → complete → release', () => {
  let harness: Harness;
  let api: ApiClient;
  let learnerId: string;
  let teacherId: string;
  let classId: string;
  let bookingId: string;

  const hour = 60 * 60 * 1000;

  beforeAll(async () => {
    harness = await startHarness();
    api = new ApiClient(harness.baseUrl);
  });

  afterAll(async () => {
    await harness.close();
  });

  beforeEach(async () => {
    await resetDatabase(harness);
    // Register a learner and a teacher through the real auth endpoint.
    const learner = await api.post('/api/auth/register', {
      email: 'learner@skillswap.test',
      displayName: 'Learner',
      password: 'learner-password',
      role: 'user',
    });
    const teacher = await api.post('/api/auth/register', {
      email: 'teacher@skillswap.test',
      displayName: 'Teacher',
      password: 'teacher-password',
      role: 'user',
    });
    expect(learner.status).toBe(201);
    expect(teacher.status).toBe(201);

    learnerId = accountIdFromToken(learner.json.accessToken);
    teacherId = accountIdFromToken(teacher.json.accessToken);
    // FR-005 publish gate: the teacher is a verified student approved for the class skill.
    await seedTeacherTrust(harness, {
      teacherId,
      verified: true,
      approvedLevels: { 'skill-guitar': 'advanced' },
    });
    api.actAs(learnerId);
  });

  async function topUpLearner(amountVnd: number): Promise<void> {
    api.actAs(learnerId);
    const start = await api.post('/api/wallet/top-ups', { amountVnd });
    expect(start.status).toBe(201);
    const providerRef = start.json.providerRef as string;

    // ADR-033: the SePay IPN settles the wallet. It carries no secret header,
    // so the receiver trusts the invoice lookup; the amount arrives as a
    // string with a fractional part, as on live Sandbox deliveries.
    const cb = await api.post('/api/wallet/top-ups/callback', sepayIpn(providerRef, amountVnd));
    expect(cb.status).toBe(200);
    expect(cb.json).toEqual({ success: true });

    const balance = await waitFor(async () => {
      const b = await walletRow(harness, learnerId);
      return b && b.availableCredits >= amountVnd / 1000 ? b : null;
    });
    expect(balance.availableCredits).toBe(amountVnd / 1000);
  }

  it('runs the whole happy path and reconciles the ledger', async () => {
    await topUpLearner(100_000); // 100 credits

    // Teacher publishes a class starting in 48h.
    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      description: 'Intro to guitar',
      startsAt: new Date(Date.now() + 48 * hour).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 2,
    });
    expect(created.status).toBe(201);
    classId = created.json.id;

    // Learner books it (pending, holds a seat).
    api.actAs(learnerId);
    const booked = await api.post(`/api/classes/${classId}/bookings`, {
      idempotencyKey: 'e2e-key-1',
    });
    expect(booked.status).toBe(201);
    bookingId = booked.json.booking.bookingId;
    expect(booked.json.booking.state).toBe('pending');

    // Confirm → settles: learner −100, teacher +90 pending, fee 10.
    const confirmed = await api.post(`/api/classes/bookings/${bookingId}/confirm`);
    expect(confirmed.status).toBe(200);

    const settled = await waitFor(async () => {
      const learner = await walletRow(harness, learnerId);
      const teacher = await walletRow(harness, teacherId);
      return learner && teacher && learner.availableCredits === 0 && teacher.pendingCredits === 90
        ? { learner, teacher }
        : null;
    });
    expect(settled.learner.availableCredits).toBe(0);
    expect(settled.teacher.availableCredits).toBe(0);
    expect(settled.teacher.pendingCredits).toBe(90);
    const bookingDebits = await harness.query<{ id: string }>(
      'wallet-ledger',
      `SELECT "id" FROM ledger_entries
        WHERE "entry_type" = 'learner_debit' AND "reference_id" = $1`,
      [bookingId],
    );
    expect(bookingDebits).toHaveLength(1);
    const walletOutcome = await harness.query<{ id: string; status: string; payload: unknown }>(
      'wallet-ledger',
      `SELECT "id", "status", "payload" FROM outbox_messages
        WHERE "event_type" = 'wallet.transaction.completed'`,
    );
    expect(walletOutcome).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ bookingId }),
        }),
      ]),
    );
    await waitFor(async () => {
      const rows = await harness.query<{ state: string }>(
        'live-class',
        'SELECT "state" FROM bookings WHERE "id" = $1',
        [bookingId],
      );
      return rows[0]?.state === 'confirmed' ? rows[0] : null;
    });

    // Room access: learner gets a participant token, outsider is denied.
    api.actAs(learnerId);
    const callWindow = await api.post(`/api/classes/bookings/${bookingId}/room-access`, {
      displayName: 'Learner',
    });
    // The class is 48h out, so the access window is not open yet.
    expect(callWindow.status).toBe(403);
    expect(callWindow.envelope.message).toMatch(/opens shortly before/i);

    // Move the class into the room window by starting it, then it can be joined.
    api.actAs(teacherId);
    // Bring the start time near now so room access opens.
    const soon = new Date(Date.now() - 60 * 1000).toISOString();
    await harness.query('live-class', 'UPDATE classes SET "starts_at" = $1 WHERE "id" = $2', [
      soon,
      classId,
    ]);
    const access = await api.post(`/api/classes/bookings/${bookingId}/room-access`, {
      displayName: 'Learner',
    });
    expect(access.status).toBe(200);
    expect(access.json.room).toBe(`skillswap-${classId}`);
    expect(access.json.token).toBeTruthy();

    api.actAs('stranger-id');
    const denied = await api.post(`/api/classes/bookings/${bookingId}/room-access`, {});
    expect(denied.status).toBe(403);

    // ADR-021 Amendment A / AC-035: the Teacher has no completion command. The
    // class completes on its own once the scheduled end passes, via the sweeper.
    const elapsed = new Date(Date.now() - 2 * hour).toISOString();
    await harness.query('live-class', 'UPDATE classes SET "starts_at" = $1 WHERE "id" = $2', [
      elapsed,
      classId,
    ]);
    await harness.resolve<ClassCompletionSweeper>(ClassCompletionSweeper).sweep();

    // The removed route must not exist (404/405), not merely be forbidden (403).
    api.actAs(teacherId);
    const removedRoute = await api.post(`/api/classes/${classId}/complete`);
    expect([404, 405]).toContain(removedRoute.status);

    const released = await waitFor(async () => {
      const teacher = await walletRow(harness, teacherId);
      return teacher && teacher.availableCredits === 90 ? teacher : null;
    });
    expect(released).toEqual({ availableCredits: 90, pendingCredits: 0 });

    // Wallet history reconciles to the balance. `release` is an internal
    // pending→available transfer, so it is not new money and is excluded from
    // the credit sum (ADR-022).
    api.actAs(teacherId);
    const history = await api.get('/api/wallet/history?limit=50');
    expect(history.status).toBe(200);
    const credits = history.json.items
      .filter((i: { direction: string; type: string }) => i.direction === 'credit' && i.type !== 'release')
      .reduce((sum: number, i: { amountCredits: number }) => sum + i.amountCredits, 0);
    const debits = history.json.items
      .filter((i: { direction: string }) => i.direction === 'debit')
      .reduce((sum: number, i: { amountCredits: number }) => sum + i.amountCredits, 0);
    const teacher = (await walletRow(harness, teacherId))!;
    expect(credits - debits).toBe(teacher.availableCredits + teacher.pendingCredits);
    expect(teacher).toEqual({ availableCredits: 90, pendingCredits: 0 });
  });

  it('keeps an unfunded booking pending, then confirms it after a funded retry (AC-005, ADR-032)', async () => {
    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      description: 'No funds class',
      startsAt: new Date(Date.now() + 48 * hour).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 2,
    });
    classId = created.json.id;

    api.actAs(learnerId);
    const booked = await api.post(`/api/classes/${classId}/bookings`, { idempotencyKey: 'k-nofunds' });
    bookingId = booked.json.booking.bookingId;

    // A confirmation request is not proof of payment. The booking stays pending
    // until the wallet emits a successful debit outcome.
    const confirmed = await api.post(`/api/classes/bookings/${bookingId}/confirm`);
    expect(confirmed.status).toBe(200);
    expect(confirmed.json).toMatchObject({
      confirmed: false,
      booking: { bookingId, state: 'pending' },
    });

    // Give the request consumer time to observe insufficient funds.
    await new Promise((r) => setTimeout(r, 2000));
    const learner = await walletRow(harness, learnerId);
    const teacher = await walletRow(harness, teacherId);
    expect(learner?.availableCredits ?? 0).toBe(0);
    expect(teacher?.pendingCredits ?? 0).toBe(0);
    const unsettledBooking = await harness.query<{ state: string }>(
      'live-class',
      'SELECT "state" FROM bookings WHERE "id" = $1',
      [bookingId],
    );
    expect(unsettledBooking[0]?.state).toBe('pending');
    const debitEntries = await harness.query(
      'wallet-ledger',
      `SELECT "id" FROM ledger_entries
        WHERE "entry_type" = 'learner_debit' AND "reference_id" = $1`,
      [bookingId],
    );
    expect(debitEntries).toHaveLength(0);
    const finalEvents = await harness.query(
      'live-class',
      `SELECT "id" FROM outbox_messages
        WHERE "event_type" = 'booking.confirmed'
          AND "payload"->>'bookingId' = $1 AND "payload"->>'settled' = 'true'`,
      [bookingId],
    );
    expect(finalEvents).toHaveLength(0);

    // Once funded, the learner can retry the same booking. Only the successful
    // wallet outcome changes its state and emits the settled confirmation.
    await topUpLearner(100_000);
    const retry = await api.post(`/api/classes/bookings/${bookingId}/confirm`);
    expect(retry.status).toBe(200);
    expect(retry.json).toMatchObject({ confirmed: false, booking: { state: 'pending' } });

    const settlement = await waitFor(async () => {
      const learnerWallet = await walletRow(harness, learnerId);
      const teacherWallet = await walletRow(harness, teacherId);
      const bookingRows = await harness.query<{ state: string }>(
        'live-class',
        'SELECT "state" FROM bookings WHERE "id" = $1',
        [bookingId],
      );
      return learnerWallet?.availableCredits === 0 &&
        teacherWallet?.pendingCredits === 90 &&
        bookingRows[0]?.state === 'confirmed'
        ? { learnerWallet, teacherWallet, state: bookingRows[0].state }
        : null;
    });
    expect(settlement.state).toBe('confirmed');
    expect(settlement.learnerWallet.availableCredits).toBe(0);
    expect(settlement.teacherWallet.pendingCredits).toBe(90);
    const settledEvents = await harness.query(
      'live-class',
      `SELECT "id" FROM outbox_messages
        WHERE "event_type" = 'booking.confirmed'
          AND "payload"->>'bookingId' = $1 AND "payload"->>'settled' = 'true'`,
      [bookingId],
    );
    expect(settledEvents).toHaveLength(1);
  });

  it('expires a pending hold and releases the seat (AC-026)', async () => {
    // A booking whose hold has already expired is swept to cancelled and emits
    // booking.cancelled; since it was never settled, the wallet is untouched.
    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      description: 'Expiry class',
      startsAt: new Date(Date.now() + 48 * hour).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 2,
    });
    classId = created.json.id;

    api.actAs(learnerId);
    const booked = await api.post(`/api/classes/${classId}/bookings`, { idempotencyKey: 'k-expire' });
    bookingId = booked.json.booking.bookingId;

    // Force the hold past its TTL, then trigger the sweeper directly (the
    // interval timer is 60s; we do not wait for it in a test).
    await harness.query('live-class', 'UPDATE bookings SET "expires_at" = $1 WHERE "id" = $2', [
      new Date(Date.now() - 60 * 1000).toISOString(),
      bookingId,
    ]);
    await harness.resolve<PendingHoldSweeper>(PendingHoldSweeper).sweep();

    const cancelled = await waitFor(async () => {
      const rows = await harness.query<{ state: string; cancel_reason: string }>(
        'live-class',
        'SELECT "state", "cancel_reason" FROM bookings WHERE "id" = $1',
        [bookingId],
      );
      return rows[0]?.state === 'cancelled' ? rows[0] : null;
    });
    expect(cancelled.cancel_reason).toBe('expired');

    // Expired (never-settled) booking → no wallet movement.
    const learner = await walletRow(harness, learnerId);
    expect(learner?.availableCredits ?? 0).toBe(0);
  });

  it('reports a stable booking rejection code, not the domain class name (RESTful-CONVENTIONS §8)', async () => {
    // A 1-seat class the teacher booked as themselves can never be booked by the
    // teacher, so `self_booking` exercises the reason → code mapping end to end.
    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      description: 'Self-booking class',
      startsAt: new Date(Date.now() + 48 * hour).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 1,
    });
    classId = created.json.id;

    const selfBooked = await api.post(`/api/classes/${classId}/bookings`, {
      idempotencyKey: 'k-self',
    });
    expect(selfBooked.status).toBe(409);
    expect(selfBooked.envelope).toMatchObject({
      success: false,
      code: 'self_booking',
      data: null,
    });
    expect(selfBooked.envelope.errors).toEqual([
      { code: 'self_booking', message: expect.any(String) },
    ]);

    // A class id that does not exist reports `class_not_found`, not the class name.
    api.actAs(learnerId);
    const missing = await api.post('/api/classes/00000000-0000-4000-8000-000000000000/bookings', {
      idempotencyKey: 'k-missing',
    });
    expect(missing.status).toBe(404);
    expect(missing.envelope).toMatchObject({ success: false, code: 'class_not_found', data: null });
  });

  it('refunds the learner when the teacher no-shows (AC-024)', async () => {
    await topUpLearner(100_000); // 100 credits

    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      description: 'No-show class',
      startsAt: new Date(Date.now() + 48 * hour).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 2,
    });
    classId = created.json.id;

    api.actAs(learnerId);
    const booked = await api.post(`/api/classes/${classId}/bookings`, { idempotencyKey: 'k-noshow' });
    bookingId = booked.json.booking.bookingId;
    await api.post(`/api/classes/bookings/${bookingId}/confirm`);

    // Settlement: learner 0, teacher 90 pending.
    await waitFor(async () => {
      const t = await walletRow(harness, teacherId);
      return t && t.pendingCredits === 90 ? t : null;
    });
    await waitFor(async () => {
      const rows = await harness.query<{ state: string }>(
        'live-class',
        'SELECT "state" FROM bookings WHERE "id" = $1',
        [bookingId],
      );
      return rows[0]?.state === 'confirmed' ? rows[0] : null;
    });

    // Teacher never joins; the no-show endpoint refunds the learner.
    // The class must be past its 15-minute join window for a no-show to apply.
    await harness.query('live-class', 'UPDATE classes SET "starts_at" = $1 WHERE "id" = $2', [
      new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      classId,
    ]);
    const noShow = await api.post(`/api/classes/bookings/${bookingId}/no-show`);
    expect(noShow.status).toBe(200);
    expect(noShow.json.cancelled).toBe(true);

    const refunded = await waitFor(async () => {
      const learner = await walletRow(harness, learnerId);
      const teacher = await walletRow(harness, teacherId);
      return learner && learner.availableCredits === 100 && teacher && teacher.pendingCredits === 0
        ? { learner, teacher }
        : null;
    });
    expect(refunded.learner.availableCredits).toBe(100);
    expect(refunded.teacher.pendingCredits).toBe(0);
  });

  it('is idempotent: replaying a settlement callback credits exactly once', async () => {
    api.actAs(learnerId);
    const start = await api.post('/api/wallet/top-ups', { amountVnd: 50_000 });
    const providerRef = start.json.providerRef as string;
    const body = sepayIpn(providerRef, 50_000);

    const first = await api.post('/api/wallet/top-ups/callback', body);
    const second = await api.post('/api/wallet/top-ups/callback', body);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // SePay is always acknowledged; the replay is a no-op.
    expect(first.json).toEqual({ success: true });
    expect(second.json).toEqual({ success: true });

    const balance = await waitFor(async () => {
      const b = await walletRow(harness, learnerId);
      return b && b.availableCredits === 50 ? b : null;
    });
    expect(balance.availableCredits).toBe(50);
  });

  describe('GET /api/wallet/top-ups/:id (FR-008 / ADR-033 poll)', () => {
    it('reports pending, then settled with the provider settlement facts', async () => {
      api.actAs(learnerId);
      const start = await api.post('/api/wallet/top-ups', { amountVnd: 80_000 });
      expect(start.status).toBe(201);
      const id = start.json.id as string;
      const providerRef = start.json.providerRef as string;

      const pending = await api.get(`/api/wallet/top-ups/${id}`);
      expect(pending.status).toBe(200);
      expect(pending.json.status).toBe('pending');
      expect(pending.json.paidAmountVnd).toBeNull();
      // The checkout URL is not persisted, so the poll never re-issues one.
      expect(pending.json.paymentUrl).toBeUndefined();

      const cb = await api.post('/api/wallet/top-ups/callback', sepayIpn(providerRef, 80_000));
      expect(cb.status).toBe(200);

      const settled = await waitFor(async () => {
        const res = await api.get(`/api/wallet/top-ups/${id}`);
        return res.json.status === 'settled' ? res : null;
      });
      expect(settled.json.status).toBe('settled');
      expect(settled.json.paidAmountVnd).toBe(80_000);
      expect(settled.json.paidAt).toEqual(expect.any(String));
    });

    it("hides another owner's intent behind a 404", async () => {
      api.actAs(learnerId);
      const start = await api.post('/api/wallet/top-ups', { amountVnd: 30_000 });
      const id = start.json.id as string;

      api.actAs(teacherId);
      const foreign = await api.get(`/api/wallet/top-ups/${id}`);
      expect(foreign.status).toBe(404);
    });

    it('answers a malformed id with 404, not a 500', async () => {
      api.actAs(learnerId);
      const res = await api.get('/api/wallet/top-ups/not-a-uuid');
      expect(res.status).toBe(404);
    });
  });
});

/**
 * A SePay IPN as it arrives on Sandbox (ADR-033, plan §5a): `ORDER_PAID` with
 * string amounts carrying a fractional part, and no secret header.
 */
/**
 * A SePay IPN as it arrives on Sandbox (ADR-033, plan §5a): `ORDER_PAID` with
 * string amounts carrying a fractional part, a local-time `transaction_date`,
 * and no secret header.
 */
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
