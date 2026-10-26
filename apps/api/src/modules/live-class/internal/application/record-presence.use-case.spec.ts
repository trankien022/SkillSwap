import { RecordPresenceUseCase } from './record-presence.use-case';
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
    const { presence, useCase } = setup();
    expect(await useCase.execute(leave('stranger-9'))).toEqual({
      accepted: false,
      reason: 'not_a_party',
    });
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

  it('exposes the Teacher first join as the no-show evidence', async () => {
    const { presence, useCase } = setup();
    await useCase.execute(join('teacher-1'));
    expect(await presence.findTeacherFirstJoin(CLASS_ID, 'teacher-1')).toEqual(AT);
    expect(await presence.findTeacherFirstJoin(CLASS_ID, 'learner-1')).toBeNull();
  });
});
