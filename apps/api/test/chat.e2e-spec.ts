import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase, seedTeacherTrust, walletRow } from './support/db';

jest.setTimeout(240_000);

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
  };
}

/**
 * W5 / FR-012 / ADR-036 (as amended): in-class chat against the real stack.
 *
 * What this proves that unit tests cannot:
 *
 * 1. A message really lands in `live_class.chat_messages` and comes back through a second request,
 *    so the round trip — insert, keyset read, contract parse — holds together.
 * 2. The **window is the room's window**. The class is aged into and out of it rather than the
 *    clock being mocked, because a mocked clock proves the domain agrees with itself, not that the
 *    adapter passes the right instants.
 * 3. A **stranger is refused and stores nothing** — asserted by counting rows, not by trusting the
 *    status code.
 * 4. **Contact information is stored like any other text** (BR-056 withdrawn, ADR-036 Amendment A).
 *    This is the one place the reversed decision could silently regress if someone re-added a
 *    detector, so it is pinned end to end.
 * 5. History stays readable **after the window closes** (decision 3).
 */
describe('E2E: in-class chat (W5 / FR-012 / ADR-036)', () => {
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
      displayName: 'Chat Party',
      password: 'chat-party-password',
      role: 'user',
    });
    expect(res.status).toBe(201);
    return accountIdFromToken(res.json.accessToken as string);
  }

  async function countMessages(classId: string): Promise<number> {
    const rows = await harness.query<{ count: string }>(
      'live-class',
      'SELECT COUNT(*)::text AS count FROM chat_messages WHERE "class_id" = $1',
      [classId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  interface Scenario {
    classId: string;
    bookingId: string;
    teacherId: string;
    learnerId: string;
  }

  /**
   * A class with a confirmed booking, aged so that `now` sits `minutesFromStart` relative to its
   * scheduled start. The class is created legitimately 48h out (the API refuses anything nearer)
   * and then moved, which is the state a real class is in — no rule is bypassed.
   */
  async function confirmedClass(label: string, minutesFromStart: number): Promise<Scenario> {
    const teacherId = await registerUser(`w5-chat-teacher-${label}@skillswap.test`);
    const learnerId = await registerUser(`w5-chat-learner-${label}@skillswap.test`);
    await seedTeacherTrust(harness, {
      teacherId,
      verified: true,
      approvedLevels: { 'skill-guitar': 'advanced' },
    });
    await seedTeacherTrust(harness, { teacherId: learnerId, verified: true });

    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      description: `Chat ${label}`,
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
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
      const wallet = await walletRow(harness, learnerId);
      return wallet !== null && wallet.availableCredits >= 100;
    });

    const booked = await api.post(`/api/classes/${classId}/bookings`, {
      idempotencyKey: `w5-chat-${label}`,
    });
    expect(booked.status).toBe(201);
    const bookingId = booked.json.booking.bookingId as string;
    expect((await api.post(`/api/classes/bookings/${bookingId}/confirm`)).status).toBe(200);
    await waitFor(async () => {
      const rows = await harness.query<{ state: string }>(
        'live-class',
        'SELECT "state" FROM bookings WHERE "id" = $1',
        [bookingId],
      );
      return rows[0]?.state === 'confirmed';
    });

    await harness.query(
      'live-class',
      'UPDATE classes SET "starts_at" = $2 WHERE "id" = $1',
      [classId, new Date(Date.now() - minutesFromStart * 60_000).toISOString()],
    );

    return { classId, bookingId, teacherId, learnerId };
  }

  it('rejects an unauthenticated caller', async () => {
    const scenario = await confirmedClass('anon', 10);
    api.actAs(null);
    const res = await api.post(`/api/classes/bookings/${scenario.bookingId}/messages`, { body: 'hi' });
    expect(res.status).toBe(401);
  });

  it('posts and reads a message for both parties, oldest first', async () => {
    const s = await confirmedClass('happy', 10);

    api.actAs(s.learnerId);
    const first = await api.post(`/api/classes/bookings/${s.bookingId}/messages`, {
      body: 'Thầy ơi, em chưa hiểu bài 3',
    });
    expect(first.status).toBe(201);
    expect(first.json).toMatchObject({
      classId: s.classId,
      bookingId: s.bookingId,
      senderId: s.learnerId,
      senderRole: 'learner',
      body: 'Thầy ơi, em chưa hiểu bài 3',
    });

    api.actAs(s.teacherId);
    const second = await api.post(`/api/classes/bookings/${s.bookingId}/messages`, {
      body: 'Để thầy giảng lại phần đạo hàm',
    });
    expect(second.status).toBe(201);
    expect(second.json.senderRole).toBe('teacher');

    const page = await api.get(`/api/classes/bookings/${s.bookingId}/messages`);
    expect(page.status).toBe(200);
    expect(page.json.items.map((m: { body: string }) => m.body)).toEqual([
      'Thầy ơi, em chưa hiểu bài 3',
      'Để thầy giảng lại phần đạo hàm',
    ]);
    expect(page.json.page.total).toBe(2);
  });

  it('refuses a stranger and stores nothing', async () => {
    const s = await confirmedClass('stranger', 10);
    const strangerId = await registerUser('w5-chat-stranger@skillswap.test');

    api.actAs(strangerId);
    const before = await countMessages(s.classId);
    const res = await api.post(`/api/classes/bookings/${s.bookingId}/messages`, { body: 'let me in' });
    expect(res.status).toBe(403);
    // The code has to survive the error filter. The first version of these routes answered
    // HTTP_403 and dropped the code, so a client had to match English prose.
    expect(res.envelope?.code).toBe('CHAT_NOT_A_PARTY');
    expect(await countMessages(s.classId)).toBe(before);

    const read = await api.get(`/api/classes/bookings/${s.bookingId}/messages`);
    expect(read.status).toBe(403);
    expect(read.envelope?.code).toBe('CHAT_NOT_A_PARTY');
  });

  it('refuses a send before the room opens and after it closes', async () => {
    const early = await confirmedClass('early', -60);
    api.actAs(early.learnerId);
    const tooEarly = await api.post(`/api/classes/bookings/${early.bookingId}/messages`, {
      body: 'too early',
    });
    expect(tooEarly.status).toBe(403);
    expect(tooEarly.envelope?.code).toBe('CHAT_WINDOW_CLOSED');

    const late = await confirmedClass('late', 90);
    api.actAs(late.learnerId);
    const tooLate = await api.post(`/api/classes/bookings/${late.bookingId}/messages`, {
      body: 'too late',
    });
    expect(tooLate.status).toBe(403);
    expect(tooLate.envelope?.code).toBe('CHAT_WINDOW_CLOSED');
  });

  it('keeps history readable after the class window has closed', async () => {
    const s = await confirmedClass('after', 10);
    api.actAs(s.learnerId);
    expect((await api.post(`/api/classes/bookings/${s.bookingId}/messages`, { body: 'see you later' })).status).toBe(201);

    // Move the class a day into the past: the send window is long gone.
    await harness.query('live-class', 'UPDATE classes SET "starts_at" = now() - interval \'1 day\' WHERE "id" = $1', [
      s.classId,
    ]);
    const afterWindow = await api.post(`/api/classes/bookings/${s.bookingId}/messages`, { body: 'hello?' });
    expect(afterWindow.status).toBe(403);
    expect(afterWindow.envelope?.code).toBe('CHAT_WINDOW_CLOSED');

    const page = await api.get(`/api/classes/bookings/${s.bookingId}/messages`);
    expect(page.status).toBe(200);
    expect(page.json.items).toHaveLength(1);
    expect(page.json.items[0].body).toBe('see you later');
  });

  it('stores contact information like any other text (BR-056 withdrawn)', async () => {
    // ADR-036 Amendment A: there is no detector. If someone reintroduces one, this fails -- which
    // is the point: the withdrawal is a product decision, and a silent re-add would reverse it.
    const s = await confirmedClass('contact', 10);
    const bodies = ['0901234567', 'minh@example.com', 'www.facebook.com/minh', 'zalo: minhnguyen'];

    api.actAs(s.learnerId);
    for (const body of bodies) {
      const res = await api.post(`/api/classes/bookings/${s.bookingId}/messages`, { body });
      expect(res.status).toBe(201);
      expect(res.json.body).toBe(body);
    }

    const page = await api.get(`/api/classes/bookings/${s.bookingId}/messages`);
    expect(page.json.items.map((m: { body: string }) => m.body)).toEqual(bodies);
  });

  it('refuses an empty message and a body over the limit', async () => {
    const s = await confirmedClass('invalid', 10);
    api.actAs(s.learnerId);
    expect((await api.post(`/api/classes/bookings/${s.bookingId}/messages`, { body: '   ' })).status).toBe(400);
    expect(
      (await api.post(`/api/classes/bookings/${s.bookingId}/messages`, { body: 'a'.repeat(1001) })).status,
    ).toBe(400);
    expect(await countMessages(s.classId)).toBe(0);
  });

  it('pages oldest-first with a cursor', async () => {
    const s = await confirmedClass('paging', 10);
    api.actAs(s.learnerId);
    for (const body of ['một', 'hai', 'ba']) {
      expect((await api.post(`/api/classes/bookings/${s.bookingId}/messages`, { body })).status).toBe(201);
    }

    const firstPage = await api.get(`/api/classes/bookings/${s.bookingId}/messages?limit=2`);
    expect(firstPage.status).toBe(200);
    expect(firstPage.json.items.map((m: { body: string }) => m.body)).toEqual(['một', 'hai']);
    expect(firstPage.json.page.nextCursor).toBeTruthy();
    // total is the conversation, not the page.
    expect(firstPage.json.page.total).toBe(3);

    const next = encodeURIComponent(firstPage.json.page.nextCursor as string);
    const secondPage = await api.get(`/api/classes/bookings/${s.bookingId}/messages?limit=2&cursor=${next}`);
    expect(secondPage.status).toBe(200);
    expect(secondPage.json.items.map((m: { body: string }) => m.body)).toEqual(['ba']);
    expect(secondPage.json.page.nextCursor).toBeNull();
  });
});
