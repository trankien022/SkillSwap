import {
  authorizeRoomAccess,
  authorizeTeacherRoomAccess,
  DEFAULT_OPEN_MINUTES,
  RoomAccessDeniedError,
  roomName,
  type RoomAccessRequest,
  type TeacherRoomAccessRequest,
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
    for (const state of ['pending', 'cancelled', 'completed'] as const) {
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

describe('teacher room access domain (FR-011 / ADR-040)', () => {
  function teacherRequest(
    overrides: Partial<TeacherRoomAccessRequest> = {},
  ): TeacherRoomAccessRequest {
    return {
      classView: {
        id: 'cls-1',
        teacherId: 'teacher-1',
        startsAt: STARTS,
        durationMinutes: DURATION_MIN,
        state: 'published',
      },
      requesterId: 'teacher-1',
      now: STARTS,
      ...overrides,
    };
  }

  it('grants the teacher moderator inside the window', () => {
    const grant = authorizeTeacherRoomAccess(teacherRequest());
    expect(grant.role).toBe('moderator');
  });

  it('joins the SAME room the learner entry point produces for that class', () => {
    const teacherRoom = authorizeTeacherRoomAccess(teacherRequest()).room;
    const learnerRoom = authorizeRoomAccess(
      request({
        booking: { id: 'b1', classId: 'cls-1', learnerId: 'learner-1', state: 'confirmed' },
        now: STARTS,
      }),
    ).room;
    expect(teacherRoom).toBe(learnerRoom);
  });

  it('denies anyone who is not the class teacher', () => {
    try {
      authorizeTeacherRoomAccess(teacherRequest({ requesterId: 'learner-1' }));
      throw new Error('expected denial');
    } catch (error) {
      expect((error as RoomAccessDeniedError).reason).toBe('not_a_party');
    }
  });

  it('allows the states a class can be joined from, and no others', () => {
    for (const state of ['published', 'full', 'in_progress'] as const) {
      expect(() =>
        authorizeTeacherRoomAccess(
          teacherRequest({ classView: { ...teacherRequest().classView, state } }),
        ),
      ).not.toThrow();
    }
    for (const state of ['draft', 'completed', 'cancelled'] as const) {
      try {
        authorizeTeacherRoomAccess(
          teacherRequest({ classView: { ...teacherRequest().classView, state } }),
        );
        throw new Error('expected denial');
      } catch (error) {
        expect((error as RoomAccessDeniedError).reason).toBe('class_not_joinable');
      }
    }
  });

  it('uses the same window as the learner path', () => {
    const opensAt = minute(-DEFAULT_OPEN_MINUTES);
    expect(() =>
      authorizeTeacherRoomAccess(teacherRequest({ now: new Date(opensAt.getTime() - 1) })),
    ).toThrow(RoomAccessDeniedError);
    expect(() => authorizeTeacherRoomAccess(teacherRequest({ now: opensAt }))).not.toThrow();

    const closesAt = minute(DURATION_MIN);
    expect(() => authorizeTeacherRoomAccess(teacherRequest({ now: closesAt }))).not.toThrow();
    expect(() =>
      authorizeTeacherRoomAccess(teacherRequest({ now: new Date(closesAt.getTime() + 1) })),
    ).toThrow(RoomAccessDeniedError);
  });

  it('labels the two window failures distinctly', () => {
    try {
      authorizeTeacherRoomAccess(teacherRequest({ now: minute(-60) }));
    } catch (error) {
      expect((error as RoomAccessDeniedError).reason).toBe('window_not_open');
    }
    try {
      authorizeTeacherRoomAccess(teacherRequest({ now: minute(DURATION_MIN + 1) }));
    } catch (error) {
      expect((error as RoomAccessDeniedError).reason).toBe('window_closed');
    }
  });
});
