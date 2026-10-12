import { spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { startHarness, type Harness } from './harness';
import { accountIdFromToken, ApiClient, waitFor } from './support/api-client';
import { resetDatabase, seedTeacherTrust, walletRow } from './support/db';

jest.setTimeout(60_000);

const JITSI_WEB = process.env.JITSI_WEB_URL ?? 'http://localhost:8000';
const JITSI_APP_ID = process.env.JITSI_APP_ID ?? 'skillswap';
const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET ?? 'skillswap_jitsi_dev_secret';

function checkJitsiPresence(): boolean {
  try {
    const probe = spawnSync('curl', ['-fs', '-k', '-m', '2', `${JITSI_WEB}/config.js`]);
    if (probe.status === 0) {
      const body = probe.stdout?.toString('utf8') ?? '';
      return body.includes('config.hosts');
    }
  } catch {
    return false;
  }
  return false;
}

const jitsiUp = checkJitsiPresence();

if (!jitsiUp) {
  console.warn(
    'Skipping Jitsi E2E: provider unavailable (start the local Jitsi stack)',
  );
}

/**
 * FR-011 (ADR-020) against the REAL self-hosted Jitsi.
 *
 * What this test proves:
 * 1. Web provider configuration: Jitsi Web advertises JWT authentication with
 *    authdomain configured (meet.jitsi) and NO anonymous domain. Actual JWT
 *    admission remains a separate client test.
 * 2. API token issuance contract: The SkillSwap API issues a valid HS256 room JWT
 *    signed with the shared secret (JITSI_APP_SECRET) carrying expected Prosody claims
 *    (iss, aud, room, role/moderator, exp) for confirmed bookings within the time window.
 *
 * What this test does NOT prove:
 * - Does not test actual WebRTC media streams, audio/video capture, or mic/camera hardware.
 * - Does not establish a real two-device participant session.
 * - Does not perform end-to-end XMPP stanza / Prosody BOSH room admission from a client.
 *
 * Execution behavior:
 * - Visibly skips the suite (describe.skip) if the Jitsi provider is unavailable or not
 *   advertising authdomain, rather than silent early returns.
 * - Optional during ordinary unit/baseline runs; intended for validation when the
 *   local Docker infrastructure stack is active.
 */
const describeJitsi = jitsiUp || process.env.JITSI_REQUIRED === 'true' ? describe : describe.skip;

describeJitsi('E2E: Jitsi room access (real host)', () => {
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

  it('Jitsi web advertises JWT auth (authdomain present, no anonymous domain)', async () => {
    const res = await fetch(`${JITSI_WEB}/config.js`);
    const config = await res.text();
    expect(config).toContain("config.hosts.authdomain = 'meet.jitsi'");
    expect(config).not.toContain('anonymousdomain');
    expect(config).not.toContain('guest.meet.jitsi');
  });

  it('the API issues a Prosody-compatible room token for a confirmed booking', async () => {

    // Register + top up the learner.
    const learner = await api.post('/api/auth/register', {
      email: 'jit-learner@skillswap.test',
      displayName: 'Jit Learner',
      password: 'learner-password',
      role: 'user',
    });
    const teacher = await api.post('/api/auth/register', {
      email: 'jit-teacher@skillswap.test',
      displayName: 'Jit Teacher',
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
