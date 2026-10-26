import { UnauthorizedException } from '@nestjs/common';
import { JitsiPresenceController } from './jitsi-presence.controller';
import type {
  RecordPresenceCommand,
  RecordPresencePort,
  RecordPresenceResult,
} from '../../../application/port/in/record-presence';

const SECRET = 'whsec_test';

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

function joinedBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    event_name: 'participant-joined',
    room: 'skillswap-cls-1',
    participant: { id: 'teacher-1' },
    timestamp: 1_760_000_000_000,
    ...overrides,
  };
}

function call(controller: JitsiPresenceController, body: unknown, headers: Record<string, string>) {
  return controller.presence({ headers, body });
}

describe('JitsiPresenceController (FR-011 / AC-035)', () => {
  it('rejects a request with no secret header', async () => {
    const { controller, presence } = controllerWith();
    await expect(call(controller, joinedBody(), {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(presence.commands).toHaveLength(0);
  });

  it('rejects a wrong secret even when the body is valid', async () => {
    const { controller, presence } = controllerWith();
    await expect(
      call(controller, joinedBody(), { 'x-jitsi-webhook-secret': 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(presence.commands).toHaveLength(0);
  });

  it('rejects a secret that is a prefix of the real one', async () => {
    // Guards against a comparison that would accept partially-matching secrets.
    const { controller } = controllerWith();
    await expect(
      call(controller, joinedBody(), { 'x-jitsi-webhook-secret': SECRET.slice(0, -1) }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses everything when no secret is configured', async () => {
    // An unconfigured deployment must not accept unauthenticated presence, because that
    // is exactly what lets a stranger close a class.
    const { controller, presence } = controllerWith('');
    await expect(
      call(controller, joinedBody(), { 'x-jitsi-webhook-secret': '' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(presence.commands).toHaveLength(0);
  });

  it('passes an authenticated join through with the resolved class and occupant', async () => {
    const { controller, presence } = controllerWith();
    const result = await call(controller, joinedBody(), { 'x-jitsi-webhook-secret': SECRET });

    expect(result).toEqual({ accepted: true });
    expect(presence.commands).toEqual([
      {
        type: 'participant-joined',
        room: 'skillswap-cls-1',
        classId: 'cls-1',
        accountId: 'teacher-1',
        occurredAt: new Date(1_760_000_000_000),
      },
    ]);
  });

  it('maps participant-left to a leave', async () => {
    const { controller, presence } = controllerWith();
    await call(controller, joinedBody({ event_name: 'participant-left' }), {
      'x-jitsi-webhook-secret': SECRET,
    });
    expect(presence.commands[0]?.type).toBe('participant-left');
  });

  it('ignores a room this application never created, without erroring', async () => {
    // Erroring would make Jitsi retry forever; changing nothing is the correct answer.
    const { controller, presence } = controllerWith();
    for (const room of ['random-room', 'skillswap-', 'xskillswap-cls-1', '']) {
      const result = await call(controller, joinedBody({ room }), {
        'x-jitsi-webhook-secret': SECRET,
      });
      expect(result).toEqual({ accepted: false, reason: 'unknown_room' });
    }
    expect(presence.commands).toHaveLength(0);
  });

  it('acknowledges a malformed body without writing presence', async () => {
    const { controller, presence } = controllerWith();
    for (const body of [null, {}, { event_name: 'chat', room: 'skillswap-c', participant: { id: 'x' } }]) {
      const result = await call(controller, body, { 'x-jitsi-webhook-secret': SECRET });
      expect(result).toEqual({ accepted: false, reason: 'unknown_room' });
    }
    expect(presence.commands).toHaveLength(0);
  });

  it('reads Jitsi timestamps given in seconds as seconds, not 1970', async () => {
    const { controller, presence } = controllerWith();
    await call(controller, joinedBody({ timestamp: 1_760_000_000 }), {
      'x-jitsi-webhook-secret': SECRET,
    });
    expect(presence.commands[0]?.occurredAt).toEqual(new Date(1_760_000_000_000));
  });

  it('treats a missing timestamp as now', async () => {
    const { controller, presence } = controllerWith();
    const before = Date.now();
    await call(controller, joinedBody({ timestamp: undefined }), {
      'x-jitsi-webhook-secret': SECRET,
    });
    const at = presence.commands[0]?.occurredAt.getTime() ?? 0;
    expect(at).toBeGreaterThanOrEqual(before);
  });
});
