import { RecordPresenceUseCase } from './record-presence.use-case';
import { ROOM_IDLE_GRACE_MINUTES, evaluateRoomIdle } from '../domain/presence';
import {
  InMemoryBookingRepository,
  InMemoryClassRepository,
  InMemoryPresenceRepository,
  classView,
  makeBooking,
} from './testing/live-class-fakes';

const CLASS_ID = 'cls-1';
const AT = new Date('2026-10-12T10:05:00.000Z');

function setup() {
  const classes = new InMemoryClassRepository(
    classView({ id: CLASS_ID, teacherId: 'teacher-1', state: 'in_progress' }),
  );
  const bookings = new InMemoryBookingRepository([
    makeBooking({ id: 'b1', classId: CLASS_ID, learnerId: 'learner-1', state: 'confirmed' }),
  ]);
  const presence = new InMemoryPresenceRepository();
  return { presence, useCase: new RecordPresenceUseCase(classes, bookings, presence) };
}

function join(accountId: string) {
  return {
    type: 'participant-joined' as const,
    room: `skillswap-${CLASS_ID}`,
    classId: CLASS_ID,
    accountId,
    occurredAt: AT,
  };
}

function leave(accountId: string) {
  return { ...join(accountId), type: 'participant-left' as const };
}

describe('RecordPresenceUseCase (FR-011 / AC-035)', () => {
  it('records a join by the Teacher', async () => {
    const { presence, useCase } = setup();
    expect(await useCase.execute(join('teacher-1'))).toEqual({ accepted: true });
    expect(await presence.listSessions(CLASS_ID)).toEqual([
      { accountId: 'teacher-1', joinedAt: AT, leftAt: null },
    ]);
  });

  it('records a join by a learner holding a confirmed booking', async () => {
    const { presence, useCase } = setup();
    expect(await useCase.execute(join('learner-1'))).toEqual({ accepted: true });
    expect(await presence.listSessions(CLASS_ID)).toHaveLength(1);
  });

  it('changes nothing when a stranger guesses the room name', async () => {
    // The attack this blocks: an outsider joining an idle room keeps it "occupied", and
    // their leaving would be the last departure that completes a class and pays out.
    const { presence, useCase } = setup();
    expect(await useCase.execute(join('stranger-9'))).toEqual({
      accepted: false,
      reason: 'not_a_party',
    });
    expect(await presence.listSessions(CLASS_ID)).toEqual([]);
  });

  it('changes nothing when a stranger sends a leave', async () => {
    // A departure is not party-checked (ADR-021 Amendment D.2), because the write is keyed on
    // `(classId, accountId)` and can only close the departee's own session. The property that
    // matters is the one asserted here: nothing is created or closed for an outsider.
    const { presence, useCase } = setup();
    expect(await useCase.execute(leave('stranger-9'))).toEqual({ accepted: true });
    expect(await presence.listSessions(CLASS_ID)).toEqual([]);
  });

  it('rejects a departure from a room that maps to no class', async () => {
    // The one check a departure keeps: the room has to be one we issued, so a lead-in
    // "skillswap-" on somebody else's room name cannot be used to probe our data.
    const { presence, useCase } = setup();
    expect(
      await useCase.execute({ ...leave('teacher-1'), room: 'skillswap-not-a-real-class' }),
    ).toEqual({ accepted: false, reason: 'unknown_room' });
    expect(await presence.listSessions(CLASS_ID)).toEqual([]);
  });

  it('rejects an occupant with no identity', async () => {
    const { useCase } = setup();
    expect(await useCase.execute(join(''))).toEqual({
      accepted: false,
      reason: 'unknown_party',
    });
  });

  it('rejects a room that maps to no class', async () => {
    const { useCase } = setup();
    expect(await useCase.execute({ ...join('teacher-1'), classId: 'cls-other' })).toEqual({
      accepted: false,
      reason: 'unknown_room',
    });
  });

  it('ignores an unconfirmed learner, who has no business in the room', async () => {
    const classes = new InMemoryClassRepository(classView({ id: CLASS_ID, teacherId: 'teacher-1' }));
    const bookings = new InMemoryBookingRepository([
      makeBooking({ id: 'b1', classId: CLASS_ID, learnerId: 'learner-1', state: 'cancelled' }),
    ]);
    const presence = new InMemoryPresenceRepository();
    const useCase = new RecordPresenceUseCase(classes, bookings, presence);

    expect(await useCase.execute(join('learner-1'))).toEqual({
      accepted: false,
      reason: 'not_a_party',
    });
    expect(await presence.listSessions(CLASS_ID)).toEqual([]);
  });

  it('is idempotent for a redelivered join and leave', async () => {
    // Jitsi retries webhooks; a duplicate must not open a second session that would then
    // keep the room looking occupied after everyone has gone.
    const { presence, useCase } = setup();
    await useCase.execute(join('teacher-1'));
    await useCase.execute(join('teacher-1'));
    expect(await presence.listSessions(CLASS_ID)).toHaveLength(1);

    await useCase.execute(leave('teacher-1'));
    await useCase.execute(leave('teacher-1'));
    const sessions = await presence.listSessions(CLASS_ID);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.leftAt).toEqual(AT);
  });

  it('records a re-join as a new session, so an idle room becomes occupied again', async () => {
    const { presence, useCase } = setup();
    await useCase.execute(join('teacher-1'));
    await useCase.execute(leave('teacher-1'));
    await useCase.execute(join('teacher-1'));
    const sessions = await presence.listSessions(CLASS_ID);
    expect(sessions).toHaveLength(2);
    expect(sessions[1]?.leftAt).toBeNull();
  });

  it('records the departure of a learner whose booking was cancelled mid-class', async () => {
    // ADR-021 Amendment D.2. Presence used to resolve its party list from `confirmed`
    // bookings only, so a learner cancelled mid-session stopped being a party: their leave
    // returned `not_a_party`, their row kept `left_at IS NULL`, and the room looked
    // permanently occupied — `room_idle` could never fire again.
    const classes = new InMemoryClassRepository(
      classView({ id: CLASS_ID, teacherId: 'teacher-1', state: 'in_progress' }),
    );
    const bookings = new InMemoryBookingRepository([
      makeBooking({ id: 'b1', classId: CLASS_ID, learnerId: 'learner-1', state: 'confirmed' }),
    ]);
    const presence = new InMemoryPresenceRepository();
    const useCase = new RecordPresenceUseCase(classes, bookings, presence);

    await useCase.execute(join('learner-1'));
    await bookings.cancelAndEmit('b1', 'class_cancelled');

    expect(await useCase.execute(leave('learner-1'))).toEqual({ accepted: true });
    const sessions = await presence.listSessions(CLASS_ID);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.leftAt).toEqual(AT);
  });

  it('lets the idle rule fire once that departure lands', async () => {
    // The point of the fix, composed: a cancelled-booking departure must leave the room
    // looking empty. Before D.2 the row stayed open, so this same evaluation reported
    // `occupied` forever and the class could only end at its scheduled time.
    const classes = new InMemoryClassRepository(
      classView({ id: CLASS_ID, teacherId: 'teacher-1', state: 'in_progress' }),
    );
    const bookings = new InMemoryBookingRepository([
      makeBooking({ id: 'b1', classId: CLASS_ID, learnerId: 'learner-1', state: 'confirmed' }),
    ]);
    const presence = new InMemoryPresenceRepository();
    const useCase = new RecordPresenceUseCase(classes, bookings, presence);
    const startsAt = new Date(AT.getTime() - 30 * 60_000);

    await useCase.execute(join('teacher-1'));
    await useCase.execute(leave('teacher-1'));
    await useCase.execute(join('learner-1'));
    await bookings.cancelAndEmit('b1', 'class_cancelled');
    await useCase.execute(leave('learner-1'));

    expect(
      evaluateRoomIdle({
        startsAt,
        now: new Date(AT.getTime() + ROOM_IDLE_GRACE_MINUTES * 60_000),
        sessions: await presence.listSessions(CLASS_ID),
      }),
    ).toEqual({ idle: true, reason: 'idle' });
  });

  it('still refuses a join from someone who is not a party', async () => {
    // The leave relaxation must not become a join relaxation: a stranger creating presence
    // is how an outsider holds a room open or becomes its last departure.
    const { presence, useCase } = setup();
    expect(await useCase.execute(join('stranger-9'))).toEqual({
      accepted: false,
      reason: 'not_a_party',
    });
    expect(await presence.listSessions(CLASS_ID)).toEqual([]);
  });

  it('does not invent a departure for an account with no open session', async () => {
    // A leave is only evidence when there is something to close. The write is a no-op here
    // (the repository only closes a matching open row), which is why the relaxed party check
    // is safe: an account can never close somebody else's session.
    const classes = new InMemoryClassRepository(
      classView({ id: CLASS_ID, teacherId: 'teacher-1', state: 'in_progress' }),
    );
    const bookings = new InMemoryBookingRepository([]);
    const presence = new InMemoryPresenceRepository();
    const useCase = new RecordPresenceUseCase(classes, bookings, presence);

    expect(await useCase.execute(leave('teacher-1'))).toEqual({ accepted: true });
    expect(await presence.listSessions(CLASS_ID)).toEqual([]);
  });

  it('exposes the Teacher first join as the no-show evidence', async () => {
    const { presence, useCase } = setup();
    await useCase.execute(join('teacher-1'));
    expect(await presence.findTeacherFirstJoin(CLASS_ID, 'teacher-1')).toEqual(AT);
    expect(await presence.findTeacherFirstJoin(CLASS_ID, 'learner-1')).toBeNull();
  });
});
