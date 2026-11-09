import { createPublicKey, createVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ApiConfig } from '../src/shared/config/api-config';
import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase, seedTeacherTrust, walletRow } from './support/db';

jest.setTimeout(60_000);

/**
 * FR-011 / ADR-039 against the REAL API.
 *
 * This used to probe a self-hosted Jitsi Web container for its `config.js`. Hosted JaaS has no
 * local surface to probe — the vendor's acceptance of a token cannot be observed without an
 * account — so the assertion moved to what *is* observable and is ours: the room-access
 * endpoint must hand a client a URL and a token that agree with each other.
 *
 * That pairing is exactly what broke silently during the migration, and then broke a second time
 * in the opposite direction. A token scoped to `skillswap-<classId>` opens a room in no tenant
 * when the URL carries an `<appId>/` prefix — but a token whose `room` claim carries that prefix
 * is rejected too, because JaaS validates the claim against `conference.<sub>` and never strips
 * the AppID. The claim must be the bare room node; `sub` carries the tenant (ADR-039
 * Amendment A). Pin that, and either mismatch becomes a test failure rather than broken video.
 *
 * What this still does NOT prove: WebRTC media, two-device sessions, or that JaaS itself accepts
 * the signature. Those need real credentials and are noted as an open risk in ADR-039.
 *
 * No skip guard: `pnpm keys:gen` always writes a usable placeholder key, so this runs offline
 * like every other suite (see the JaaS row in `.env.example`).
 */
const describeJaas = describe;

describeJaas('E2E: JaaS room access (FR-011 / ADR-039)', () => {
  let harness: Harness;
  let api: ApiClient;
  let config: ApiConfig;

  beforeAll(async () => {
    harness = await startHarness();
    api = new ApiClient(harness.baseUrl);
    config = harness.resolve<ApiConfig>(ApiConfig);
    await resetDatabase(harness);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  it('issues a tenant-scoped RS256 room token for a confirmed booking', async () => {
    // Register + top up the learner.
    const learner = await api.post('/api/auth/register', {
      email: 'jaas-learner@skillswap.test',
      displayName: 'JaaS Learner',
      password: 'learner-password',
      role: 'user',
    });
    const teacher = await api.post('/api/auth/register', {
      email: 'jaas-teacher@skillswap.test',
      displayName: 'JaaS Teacher',
      password: 'teacher-password',
      role: 'user',
    });
    const learnerId = accountIdFromToken(learner.json.accessToken);
    const teacherId = accountIdFromToken(teacher.json.accessToken);
    // FR-005 publish gate: the teacher must be a verified student approved for the skill.
    await seedTeacherTrust(harness, {
      teacherId,
      verified: true,
      approvedLevels: { 'skill-guitar': 'advanced' },
    });
    // AC-034: the learner must hold an approved student verification to book at all.
    await seedTeacherTrust(harness, { teacherId: learnerId, verified: true });

    api.actAs(learnerId);
    const topUp = await api.post('/api/wallet/top-ups', { amountVnd: 100_000 });
    const providerRef = topUp.json.providerRef as string;
    // ADR-033: settle via a SePay IPN (no secret header; invoice correlation).
    await api.post('/api/wallet/top-ups/callback', {
      notification_type: 'ORDER_PAID',
      order: {
        order_id: `PAY-${providerRef}`,
        order_status: 'CAPTURED',
        order_currency: 'VND',
        order_amount: '100000.00',
        order_invoice_number: providerRef,
      },
      transaction: {
        payment_method: 'BANK_TRANSFER',
        transaction_status: 'APPROVED',
        transaction_amount: '100000',
      },
    });
    await waitFor(async () => {
      const b = await walletRow(harness, learnerId);
      return b && b.availableCredits === 100 ? b : null;
    });

    // Teacher publishes a class, learner books and confirms it.
    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      title: 'JaaS room class',
      description: 'JaaS class',
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 2,
    });
    const classId = created.json.id as string;

    api.actAs(learnerId);
    const booked = await api.post(`/api/classes/${classId}/bookings`, { idempotencyKey: 'jaas-key' });
    const bookingId = booked.json.booking.bookingId as string;
    await api.post(`/api/classes/bookings/${bookingId}/confirm`);
    await waitFor(async () => {
      const row = await walletRow(harness, learnerId);
      return row && row.availableCredits === 0 ? row : null;
    });
    await waitFor(async () => {
      const rows = await harness.query<{ state: string }>(
        'live-class',
        'SELECT "state" FROM bookings WHERE "id" = $1',
        [bookingId],
      );
      return rows[0]?.state === 'confirmed' ? rows[0] : null;
    });

    // Open the room window by pulling the start time to now.
    await harness.query('live-class', 'UPDATE classes SET "starts_at" = $1 WHERE "id" = $2', [
      new Date(Date.now() - 60 * 1000).toISOString(),
      classId,
    ]);

    const access = await api.post(`/api/classes/bookings/${bookingId}/room-access`, {
      displayName: 'JaaS Learner',
    });
    expect(access.status).toBe(200);

    // The domain's room stays provider-agnostic...
    const room = access.json.room as string;
    expect(room).toBe(`skillswap-${classId}`);

    // ...while the URL carries the tenant, so `https://<JITSI_DOMAIN>/<room>` is a real meeting.
    expect(access.json.url).toBe(`https://${config.jitsiDomain}/${room}`);

    // The token names the **bare** room node, not the tenant-qualified one the URL opens. JaaS's
    // validator builds the expected MUC address as `jid.join(claim, "conference." .. sub)`, so a
    // claim that already carries the AppID can never match a real room and every join fails with
    // "Room and token mismatched" — reproduced against the live tenant (ADR-039 Amendment A).
    // The tenant is carried by `sub`, asserted below; the URL prefix is a different field.
    const token = access.json.token as string;
    const [headerB64, payloadB64, sigB64] = token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
      alg: string;
      kid: string;
      typ: string;
    };
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      aud: string;
      iss: string;
      sub: string;
      room: string;
      exp: number;
      context: { user: { id: string; moderator: unknown } };
    };

    expect(header.alg).toBe('RS256');
    expect(header.kid).toBe(`${config.jitsiAppId}/${config.jitsiKeyId}`);
    expect(payload.aud).toBe('jitsi');
    expect(payload.iss).toBe('chat');
    expect(payload.sub).toBe(config.jitsiAppId);
    expect(payload.room).toBe(room);
    // Locks the regression: a tenant-qualified claim makes every join fail with
    // "Room and token mismatched", which surfaces to users as broken video.
    expect(payload.room).not.toContain('/');
    expect(payload.context.user.id).toBe(learnerId);
    // A Learner is never a moderator; a regression here would let them end the class early.
    expect(payload.context.user.moderator).toBe('false');
    expect(typeof payload.exp).toBe('number');

    // The signature must verify against the key the API is configured with — this catches a
    // truncated PEM or a key replaced at runtime without a restart.
    const publicKeyPem = createPublicKeyFromPrivate(config.jitsiPrivateKeyPath);
    const verified = createVerify('RSA-SHA256')
      .update(`${headerB64}.${payloadB64}`)
      .verify(publicKeyPem, Buffer.from(sigB64, 'base64url'));
    expect(verified).toBe(true);

    // The teacher's token is a moderator token for the same bare room node.
    api.actAs(teacherId);
    const teacherAccess = await api.post(`/api/classes/bookings/${bookingId}/room-access`, {
      displayName: 'JaaS Teacher',
    });
    const teacherPayload = JSON.parse(
      Buffer.from((teacherAccess.json.token as string).split('.')[1], 'base64url').toString('utf8'),
    ) as { room: string; context: { user: { moderator: unknown } } };
    expect(teacherPayload.room).toBe(room);
    // String, not boolean: a boolean silently demotes the teacher (ADR-039 decision 2).
    expect(teacherPayload.context.user.moderator).toBe('true');
  });
});

/** Derives the public key from the configured private PEM, so no second path is configured. */
function createPublicKeyFromPrivate(path: string): string {
  return createPublicKey(readFileSync(path, 'utf8')).export({ type: 'spki', format: 'pem' }).toString();
}
