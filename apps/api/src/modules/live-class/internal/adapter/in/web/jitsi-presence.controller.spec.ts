import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JitsiPresenceController } from './jitsi-presence.controller';
import type {
  RecordPresenceCommand,
  RecordPresencePort,
  RecordPresenceResult,
} from '../../../application/port/in/record-presence';

const SECRET = 'whsec_test';
const APP_ID = 'vpaas-magic-cookie-1fc542a3e4414a44b2611668195e2bfe';

class SpyPresence implements RecordPresencePort {
  readonly commands: RecordPresenceCommand[] = [];
  result: RecordPresenceResult = { accepted: true };

  async execute(command: RecordPresenceCommand): Promise<RecordPresenceResult> {
    this.commands.push(command);
    return this.result;
  }
}

function controllerWith(secret: string = SECRET): {
  controller: JitsiPresenceController;
  presence: SpyPresence;
} {
  const presence = new SpyPresence();
  return { controller: new JitsiPresenceController(presence, secret), presence };
}

function joinedBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventType: 'PARTICIPANT_JOINED',
    appId: APP_ID,
    fqn: `${APP_ID}/skillswap-cls-1`,
    timestamp: 1_760_000_000_000,
    data: { id: 'teacher-1', participantId: 'p-1' },
    ...overrides,
  };
}

/** Reproduces JaaS's `X-Jaas-Signature` for a given raw body. */
function signatureFor(body: unknown, secret: string = SECRET, at = Math.floor(Date.now() / 1000)): string {
  const raw = JSON.stringify(body);
  const digest = createHmac('sha256', secret).update(`${at}.${raw}`, 'utf8').digest('base64');
  return `t=${at},v1=${digest}`;
}

function call(
  controller: JitsiPresenceController,
  body: unknown,
  headers: Record<string, string>,
) {
  // The controller verifies over the raw bytes, so the test passes what a real delivery would.
  return controller.presence({ headers, body, rawBody: Buffer.from(JSON.stringify(body), 'utf8') });
}

describe('JitsiPresenceController (FR-011 / AC-035 / ADR-039)', () => {
  it('rejects a request with no signature header', async () => {
    const { controller, presence } = controllerWith();
    await expect(call(controller, joinedBody(), {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(presence.commands).toHaveLength(0);
  });

  it('rejects a signature computed with the wrong secret', async () => {
    const { controller, presence } = controllerWith();
    const body = joinedBody();
    await expect(
      call(controller, body, { 'x-jaas-signature': signatureFor(body, 'not-the-secret') }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(presence.commands).toHaveLength(0);
  });

  it('rejects a correctly signed body that was tampered with afterwards', async () => {
    // The signature covers the bytes, not the parsed fields, so an edited body must not pass.
    const { controller } = controllerWith();
    const original = joinedBody();
    const header = signatureFor(original);
    const tampered = joinedBody({ data: { id: 'someone-else' } });
    await expect(
      controller.presence({
        headers: { 'x-jaas-signature': header },
        body: tampered,
        rawBody: Buffer.from(JSON.stringify(tampered), 'utf8'),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a signature without a raw body instead of re-serialising one', async () => {
    // Falling back to JSON.stringify would keep a test green while rejecting every real
    // delivery, because the vendor's key order and spacing are not ours to reproduce.
    const { controller } = controllerWith();
    const body = joinedBody();
    await expect(
      controller.presence({ headers: { 'x-jaas-signature': signatureFor(body) }, body }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a stale, correctly signed delivery to bound replay', async () => {
    const { controller } = controllerWith();
    const body = joinedBody();
    const old = Math.floor(Date.now() / 1000) - 3600;
    await expect(
      call(controller, body, { 'x-jaas-signature': signatureFor(body, SECRET, old) }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses everything when no secret is configured', async () => {
    // An unconfigured deployment must not accept unauthenticated presence, because that
    // is exactly what lets a stranger close a class.
    const { controller, presence } = controllerWith('');
    const body = joinedBody();
    await expect(
      call(controller, body, { 'x-jaas-signature': signatureFor(body, '') }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(presence.commands).toHaveLength(0);
  });

  it('passes an authenticated join through with the resolved class and occupant', async () => {
    const { controller, presence } = controllerWith();
    const body = joinedBody();
    const result = await call(controller, body, { 'x-jaas-signature': signatureFor(body) });

    expect(result).toEqual({ accepted: true });
    expect(presence.commands).toEqual([
      {
        type: 'participant-joined',
        // The full tenant-qualified name is forwarded; the class id is derived from it.
        room: `${APP_ID}/skillswap-cls-1`,
        classId: 'cls-1',
        accountId: 'teacher-1',
        occurredAt: new Date(1_760_000_000_000),
      },
    ]);
  });

  it('maps PARTICIPANT_LEFT to a leave', async () => {
    const { controller, presence } = controllerWith();
    const body = joinedBody({ eventType: 'PARTICIPANT_LEFT' });
    await call(controller, body, { 'x-jaas-signature': signatureFor(body) });
    expect(presence.commands[0]?.type).toBe('participant-left');
  });

  it('acknowledges unrelated JaaS events without writing presence', async () => {
    // Recording, lobby and transcription events are real but mean nothing here; a 400 would
    // make JaaS retry them forever.
    const { controller, presence } = controllerWith();
    for (const eventType of ['RECORDING_STARTED', 'PARTICIPANT_JOINED_LOBBY', 'CHAT_UPLOADED']) {
      const body = joinedBody({ eventType });
      const result = await call(controller, body, { 'x-jaas-signature': signatureFor(body) });
      expect(result).toEqual({ accepted: false, reason: 'unknown_room' });
    }
    expect(presence.commands).toHaveLength(0);
  });

  it('ignores a room this application never created, without erroring', async () => {
    // Erroring would make JaaS retry forever; changing nothing is the correct answer.
    const { controller, presence } = controllerWith();
    for (const fqn of [
      'random-room',
      `${APP_ID}/random-room`,
      `${APP_ID}/skillswap-`,
      `${APP_ID}/xskillswap-cls-1`,
    ]) {
      const body = joinedBody({ fqn });
      const result = await call(controller, body, { 'x-jaas-signature': signatureFor(body) });
      expect(result).toEqual({ accepted: false, reason: 'unknown_room' });
    }
    expect(presence.commands).toHaveLength(0);
  });

  it('acknowledges a malformed body without writing presence', async () => {
    const { controller, presence } = controllerWith();
    for (const body of [null, {}, { eventType: 'PARTICIPANT_JOINED' }]) {
      const result = await call(controller, body, { 'x-jaas-signature': signatureFor(body) });
      expect(result).toEqual({ accepted: false, reason: 'unknown_room' });
    }
    expect(presence.commands).toHaveLength(0);
  });

  it('refuses an event with no jwt identity rather than guessing the party', async () => {
    const { controller, presence } = controllerWith();
    const body = joinedBody({ data: { participantId: 'p-1' } });
    const result = await call(controller, body, { 'x-jaas-signature': signatureFor(body) });
    expect(result).toEqual({ accepted: false, reason: 'unknown_party' });
    expect(presence.commands).toHaveLength(0);
  });

  it('reads JaaS timestamps given in seconds as seconds, not 1970', async () => {
    const { controller, presence } = controllerWith();
    const body = joinedBody({ timestamp: 1_760_000_000 });
    await call(controller, body, { 'x-jaas-signature': signatureFor(body) });
    expect(presence.commands[0]?.occurredAt).toEqual(new Date(1_760_000_000_000));
  });

  it('treats a missing timestamp as now', async () => {
    const { controller, presence } = controllerWith();
    const body = joinedBody({ timestamp: undefined });
    const before = Date.now();
    await call(controller, body, { 'x-jaas-signature': signatureFor(body) });
    const at = presence.commands[0]?.occurredAt.getTime() ?? 0;
    expect(at).toBeGreaterThanOrEqual(before);
  });
});
