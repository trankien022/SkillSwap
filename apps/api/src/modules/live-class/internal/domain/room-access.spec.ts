import {
  authorizeRoomAccess,
  DEFAULT_OPEN_MINUTES,
  RoomAccessDeniedError,
  roomName,
  type RoomAccessRequest,
} from './room-access';

const STARTS = new Date('2026-10-12T10:00:00.000Z');
const DURATION_MIN = 60;

function request(overrides: Partial<RoomAccessRequest> = {}): RoomAccessRequest {
  return {
    booking: { id: 'b1', classId: 'cls-1', learnerId: 'learner-1', state: 'confirmed' },
    classView: { teacherId: 'teacher-1', startsAt: STARTS, durationMinutes: DURATION_MIN },
    requesterId: 'learner-1',
    now: STARTS,
    ...overrides,
  };
}

function minute(offsetMin: number): Date {
  return new Date(STARTS.getTime() + offsetMin * 60 * 1000);
}

describe('room access domain (FR-011 / AC-006)', () => {
  it('derives a deterministic, non-PII room name from the class id', () => {
    expect(roomName('cls-1')).toBe('skillswap-cls-1');
  });

  it('grants the learner the participant role and the teacher moderator', () => {
    expect(authorizeRoomAccess(request({ requesterId: 'learner-1' })).role).toBe('participant');
    expect(authorizeRoomAccess(request({ requesterId: 'teacher-1' })).role).toBe('moderator');
  });

  it('denies a requester who is not a party (AC-006)', () => {
    try {
      authorizeRoomAccess(request({ requesterId: 'stranger' }));
      throw new Error('expected denial');
    } catch (error) {
      expect((error as RoomAccessDeniedError).reason).toBe('not_a_party');
    }
  });

  it('denies a booking that is not confirmed', () => {
    for (const state of ['pending', 'cancelled', 'completed', 'disputed'] as const) {
      expect(() =>
        authorizeRoomAccess(request({ booking: { id: 'b1', classId: 'cls-1', learnerId: 'learner-1', state } })),
      ).toThrow(RoomAccessDeniedError);
    }
  });

  it('opens exactly DEFAULT_OPEN_MINUTES before the start and closes at the end', () => {
    const opensAt = minute(-DEFAULT_OPEN_MINUTES);
    expect(() => authorizeRoomAccess(request({ now: new Date(opensAt.getTime() - 1) }))).toThrow(
      RoomAccessDeniedError,
    );
    expect(() => authorizeRoomAccess(request({ now: opensAt }))).not.toThrow();

    const closesAt = minute(DURATION_MIN);
    expect(() => authorizeRoomAccess(request({ now: closesAt }))).not.toThrow();
    expect(() => authorizeRoomAccess(request({ now: new Date(closesAt.getTime() + 1) }))).toThrow(
      RoomAccessDeniedError,
    );
  });

  it('labels the two window failures distinctly', () => {
    try {
      authorizeRoomAccess(request({ now: minute(-60) }));
    } catch (error) {
      expect((error as RoomAccessDeniedError).reason).toBe('window_not_open');
    }
    try {
      authorizeRoomAccess(request({ now: minute(DURATION_MIN + 1) }));
    } catch (error) {
      expect((error as RoomAccessDeniedError).reason).toBe('window_closed');
    }
  });
});
