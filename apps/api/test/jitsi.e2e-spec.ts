import { createHmac } from 'node:crypto';
import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase, walletRow } from './support/db';

jest.setTimeout(60_000);

const JITSI_WEB = process.env.JITSI_WEB_URL ?? 'http://localhost:8000';
const JITSI_APP_ID = process.env.JITSI_APP_ID ?? 'skillswap';
const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET ?? 'skillswap_jitsi_dev_secret';

/**
 * FR-011 (ADR-020) against the REAL self-hosted Jitsi: the API issues a Jitsi
 * JWT and we assert it is a valid, Prosody-compatible token (HS256 with the
 * shared app secret and the claims Prosody verifies). Skips gracefully if the
 * Jitsi container is not running.
 */
describe('E2E: Jitsi room access (real host)', () => {
  let harness: Harness;
  let api: ApiClient;
  let jitsiUp = false;

  beforeAll(async () => {
    try {
      const res = await fetch(`${JITSI_WEB}/config.js`, { signal: AbortSignal.timeout(4000) });
      const body = await res.text();
      jitsiUp = res.ok && body.includes('anonymousdomain');
    } catch {
      jitsiUp = false;
    }
    if (!jitsiUp) {
      console.warn('Skipping Jitsi E2E: start it with "docker compose up -d jitsi-web jitsi-prosody jitsi-jicofo jitsi-jvb"');
      return;
    }
    harness = await startHarness();
    api = new ApiClient(harness.baseUrl);
    await resetDatabase(harness);
  });

  afterAll(async () => {
    if (harness) {
      await harness.close();
    }
  });

  it('Jitsi web advertises JWT auth (anonymous + auth domains)', async () => {
    if (!jitsiUp) return;
    const config = await (await fetch(`${JITSI_WEB}/config.js`)).text();
    expect(config).toContain("config.hosts.anonymousdomain = 'guest.meet.jitsi'");
    expect(config).toContain("config.hosts.authdomain = 'meet.jitsi'");
  });

  it('the API issues a Prosody-compatible room token for a confirmed booking', async () => {
    if (!jitsiUp) return;

    // Register + top up the learner.
    const learner = await api.post('/api/auth/register', {
      email: 'jit-learner@skillswap.test',
      displayName: 'Jit Learner',
      password: 'learner-password',
      role: 'learner',
    });
    const teacher = await api.post('/api/auth/register', {
      email: 'jit-teacher@skillswap.test',
      displayName: 'Jit Teacher',
      password: 'teacher-password',
      role: 'teacher',
    });
    const learnerId = accountIdFromToken(learner.json.accessToken);
    const teacherId = accountIdFromToken(teacher.json.accessToken);

    api.actAs(learnerId);
    const topUp = await api.post('/api/wallet/top-ups', { amountVnd: 100_000 });
    const providerRef = topUp.json.providerRef as string;
    const cbBody = { providerRef, amountVnd: 100_000, status: 'settled' as const };
    await api.request('POST', '/api/wallet/top-ups/callback', cbBody, {
      signature: createHmac('sha256', 'dev-webhook-secret').update(JSON.stringify(cbBody)).digest('hex'),
    });
    await waitFor(async () => {
      const b = await walletRow(harness, learnerId);
      return b && b.availableCredits === 100 ? b : null;
    });

    // Teacher publishes a class, learner books and confirms it.
    api.actAs(teacherId);
    const created = await api.post('/api/classes', {
      skillIds: ['skill-guitar'],
      description: 'Jitsi class',
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 2,
    });
    const classId = created.json.id as string;

    api.actAs(learnerId);
    const booked = await api.post(`/api/classes/${classId}/bookings`, { idempotencyKey: 'jitsi-key' });
    const bookingId = booked.json.booking.bookingId as string;
    await api.post(`/api/classes/bookings/${bookingId}/confirm`);
    await waitFor(async () => {
      const learner = await walletRow(harness, learnerId);
      return learner && learner.availableCredits === 0 ? learner : null;
    });

    // Open the room window by pulling the start time to now.
    await harness.query('live-class', 'UPDATE classes SET "starts_at" = $1 WHERE "id" = $2', [
      new Date(Date.now() - 60 * 1000).toISOString(),
      classId,
    ]);

    const access = await api.post(`/api/classes/bookings/${bookingId}/room-access`, {
      displayName: 'Jit Learner',
    });
    expect(access.status).toBe(200);
    expect(access.json.room).toBe(`skillswap-${classId}`);

    // The issued token must be a valid HS256 JWT for Prosody: verify the
    // signature with the shared app secret and check the claims Prosody reads.
    const token = access.json.token as string;
    const [headerB64, payloadB64, sigB64] = token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(payload.aud).toBe(JITSI_APP_ID);
    expect(payload.iss).toBe(JITSI_APP_ID);
    expect(payload.room).toBe(`skillswap-${classId}`);
    expect(payload.context.user.moderator).toBe(false);
    expect(typeof payload.exp).toBe('number');

    const expected = createHmac('sha256', JITSI_APP_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    expect(sigB64).toBe(expected);

    // The teacher's token is a moderator token for the same room.
    api.actAs(teacherId);
    const teacherAccess = await api.post(`/api/classes/bookings/${bookingId}/room-access`, {
      displayName: 'Jit Teacher',
    });
    const teacherPayload = JSON.parse(
      Buffer.from(teacherAccess.json.token.split('.')[1], 'base64url').toString('utf8'),
    );
    expect(teacherPayload.context.user.moderator).toBe(true);
  });
});
