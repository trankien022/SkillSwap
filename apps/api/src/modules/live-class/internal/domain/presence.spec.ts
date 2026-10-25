import {
  evaluateRoomIdle,
  isRoomIdle,
  ROOM_IDLE_GRACE_MINUTES,
  type PresenceSession,
} from './presence';

/**
 * FR-020 / AC-035 (W1 C3a/C3b, decided 2026-10-25): the room-idle truth table.
 *
 * This is the table the plan asks for, written so each row names the failure it prevents
 * rather than only the happy path. The three dangerous rows are "before start", "teacher left
 * but a learner stayed", and "no presence at all" — each of those would otherwise complete a
 * live class and release money.
 */

const STARTS_AT = new Date('2026-10-25T10:00:00.000Z');
const minutes = (n: number): number => n * 60_000;

function session(accountId: string, leftMinutesAfterStart: number | null): PresenceSession {
  return {
    accountId,
    joinedAt: new Date(STARTS_AT.getTime() + minutes(1)),
    leftAt:
      leftMinutesAfterStart === null
        ? null
        : new Date(STARTS_AT.getTime() + minutes(leftMinutesAfterStart)),
  };
}

function at(minutesAfterStart: number): Date {
  return new Date(STARTS_AT.getTime() + minutes(minutesAfterStart));
}

describe('room idle rule (AC-035)', () => {
  it('is always false before the class starts, even with nobody in the room', () => {
    // The failure this prevents: an unstarted class completing itself and releasing income.
    const result = evaluateRoomIdle({
      startsAt: STARTS_AT,
      now: new Date(STARTS_AT.getTime() - minutes(30)),
      sessions: [],
    });

    expect(result).toEqual({ idle: false, reason: 'not_started' });
  });

  it('is false before the class starts even when everyone has already left', () => {
    // A room visited early does not license an early end.
    const result = evaluateRoomIdle({
      startsAt: STARTS_AT,
      now: new Date(STARTS_AT.getTime() - minutes(1)),
      sessions: [{ accountId: 'a', joinedAt: at(-10), leftAt: at(-6) }],
    });

    expect(result.idle).toBe(false);
    expect(result.reason).toBe('not_started');
  });

  it('is false when no presence was ever recorded, because silence is not absence', () => {
    // The degradation path (E9): a webhook outage must never complete a class early.
    const result = evaluateRoomIdle({ startsAt: STARTS_AT, now: at(30), sessions: [] });

    expect(result).toEqual({ idle: false, reason: 'presence_unknown' });
  });

  it('is false while a participant is still in the room', () => {
    const result = evaluateRoomIdle({
      startsAt: STARTS_AT,
      now: at(60),
      sessions: [session('teacher', 5), session('learner', null)],
    });

    expect(result).toEqual({ idle: false, reason: 'occupied' });
  });

  it('is false when the teacher leaves but a learner stays', () => {
    // The rule is about the room, not the Teacher. A learner still attending keeps it open.
    const result = evaluateRoomIdle({
      startsAt: STARTS_AT,
      now: at(45),
      sessions: [session('teacher', 10), { ...session('learner', null) }],
    });

    expect(result.idle).toBe(false);
    expect(result.reason).toBe('occupied');
  });

  it('is false while everyone is out but still inside the grace period', () => {
    const result = evaluateRoomIdle({
      startsAt: STARTS_AT,
      now: at(20),
      sessions: [session('teacher', 16), session('learner', 17)],
    });

    expect(result).toEqual({ idle: false, reason: 'within_grace' });
  });

  it('is false right up to the last millisecond of the grace period', () => {
    const leftAt = at(20);
    const result = evaluateRoomIdle({
      startsAt: STARTS_AT,
      now: new Date(leftAt.getTime() + minutes(ROOM_IDLE_GRACE_MINUTES) - 1),
      sessions: [session('teacher', 20)],
    });

    expect(result.idle).toBe(false);
    expect(result.reason).toBe('within_grace');
  });

  it('is true once everyone has been gone for the whole grace period', () => {
    const leftAt = at(20);
    const result = evaluateRoomIdle({
      startsAt: STARTS_AT,
      now: new Date(leftAt.getTime() + minutes(ROOM_IDLE_GRACE_MINUTES)),
      sessions: [session('teacher', 20), session('learner', 18)],
    });

    expect(result).toEqual({ idle: true, reason: 'idle' });
  });

  it('measures the grace period from the LAST participant to leave', () => {
    // The early leaver must not start the clock for the one who stayed longer.
    const result = evaluateRoomIdle({
      startsAt: STARTS_AT,
      now: at(24),
      sessions: [session('teacher', 10), session('learner', 21)],
    });

    expect(result.idle).toBe(false);
    expect(result.reason).toBe('within_grace');
  });

  it('is un-idled by a participant who re-joins', () => {
    // Presence is a set of sessions, so a later row with no `leftAt` means somebody is back.
    const result = evaluateRoomIdle({
      startsAt: STARTS_AT,
      now: at(40),
      sessions: [
        session('teacher', 12),
        session('learner', 13),
        { accountId: 'learner', joinedAt: at(35), leftAt: null },
      ],
    });

    expect(result.idle).toBe(false);
    expect(result.reason).toBe('occupied');
  });

  it('honours an explicit grace period', () => {
    const result = evaluateRoomIdle({
      startsAt: STARTS_AT,
      now: at(20),
      sessions: [session('teacher', 18)],
      graceMinutes: 1,
    });

    expect(result.idle).toBe(true);
  });

  it('exposes a boolean helper that agrees with the verdict', () => {
    expect(isRoomIdle({ startsAt: STARTS_AT, now: at(60), sessions: [] })).toBe(false);
    expect(isRoomIdle({ startsAt: STARTS_AT, now: at(60), sessions: [session('t', 10)] })).toBe(
      true,
    );
  });

  it('uses a five-minute grace period by default (W1 C3b)', () => {
    expect(ROOM_IDLE_GRACE_MINUTES).toBe(5);

    const leftAt = at(20);
    expect(
      isRoomIdle({
        startsAt: STARTS_AT,
        now: new Date(leftAt.getTime() + minutes(4)),
        sessions: [session('teacher', 20)],
      }),
    ).toBe(false);
    expect(
      isRoomIdle({
        startsAt: STARTS_AT,
        now: new Date(leftAt.getTime() + minutes(5)),
        sessions: [session('teacher', 20)],
      }),
    ).toBe(true);
  });
});
