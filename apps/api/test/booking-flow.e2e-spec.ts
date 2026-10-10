import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase, walletRow } from './support/db';
import { PendingHoldSweeper } from '../src/modules/live-class/internal/adapter/in/scheduler/pending-hold.sweeper';

jest.setTimeout(60_000);

/**
 * End-to-end booking flow against REAL Postgres and REAL RabbitMQ (docker).
 * Payment is the mock gateway. Events cross module boundaries through the
 * outbox relay + consumer, exactly as in production, so assertions poll for the
 * downstream effect rather than reading a synchronous return value.
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
      role: 'learner',
    });
    const teacher = await api.post('/api/auth/register', {
      email: 'teacher@skillswap.test',
      displayName: 'Teacher',
      password: 'teacher-password',
      role: 'teacher',
    });
    expect(learner.status).toBe(201);
    expect(teacher.status).toBe(201);

    learnerId = accountIdFromToken(learner.json.accessToken);
    teacherId = accountIdFromToken(teacher.json.accessToken);
    api.actAs(learnerId);
  });

  async function topUpLearner(amountVnd: number): Promise<void> {
    api.actAs(learnerId);
    const start = await api.post('/api/wallet/top-ups', { amountVnd });
    expect(start.status).toBe(201);
    const providerRef = start.json.providerRef as string;

    // Provider callback settles the wallet. Signature: HMAC over the raw body
    // with PAYMENT_WEBHOOK_SECRET (the api computes it the same way).
    const body = { providerRef, amountVnd, status: 'settled' as const };
    const signature = hmacSignature(JSON.stringify(body), 'dev-webhook-secret');
    const cb = await api.request('POST', '/api/wallet/top-ups/callback', body, { signature });
    expect(cb.status).toBe(200);

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

    // Room access: learner gets a participant token, outsider is denied.
    api.actAs(learnerId);
    const callWindow = await api.post(`/api/classes/bookings/${bookingId}/room-access`, {
      displayName: 'Learner',
    });
    // The class is 48h out, so the access window is not open yet.
    expect(callWindow.status).toBe(403);
    expect(callWindow.json.message).toMatch(/opens shortly before/i);

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

    // Complete the class (teacher held it) → releases the teacher's income.
    const elapsed = new Date(Date.now() + 2 * hour).toISOString();
    await harness.query('live-class', 'UPDATE classes SET "starts_at" = $1 WHERE "id" = $2', [
      elapsed,
      classId,
    ]);
    api.actAs(teacherId);
    const completed = await api.post(`/api/classes/${classId}/complete`);
    expect(completed.status).toBe(200);
    expect(completed.json).toEqual({ completed: true, basis: 'teacher_ended' });

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

  it('rejects a booking when the learner has no balance (AC-005)', async () => {
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

    // Confirm tries to settle with a zero balance.
    const confirmed = await api.post(`/api/classes/bookings/${bookingId}/confirm`);
    expect(confirmed.status).toBe(200); // the request succeeds; the consumer fails to settle

    // Give the consumer time to attempt (and fail) the settlement.
    await new Promise((r) => setTimeout(r, 2000));
    const learner = await walletRow(harness, learnerId);
    const teacher = await walletRow(harness, teacherId);
    expect(learner?.availableCredits ?? 0).toBe(0);
    expect(teacher?.pendingCredits ?? 0).toBe(0);
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
    const body = { providerRef, amountVnd: 50_000, status: 'settled' as const };
    const signature = hmacSignature(JSON.stringify(body), 'dev-webhook-secret');

    const first = await api.request('POST', '/api/wallet/top-ups/callback', body, { signature });
    const second = await api.request('POST', '/api/wallet/top-ups/callback', body, { signature });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.json.applied).toBe(false); // replay acknowledged, not re-applied

    const balance = await waitFor(async () => {
      const b = await walletRow(harness, learnerId);
      return b && b.availableCredits === 50 ? b : null;
    });
    expect(balance.availableCredits).toBe(50);
  });
});

/** HMAC-SHA256 hex over the raw body (mirrors HmacWebhookSignatureVerifier). */
function hmacSignature(body: string, secret: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac } = require('node:crypto') as typeof import('node:crypto');
  return createHmac('sha256', secret).update(body).digest('hex');
}
