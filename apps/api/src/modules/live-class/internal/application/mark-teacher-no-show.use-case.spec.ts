import { MarkTeacherNoShowUseCase } from './mark-teacher-no-show.use-case';
import { TEACHER_NO_SHOW_WINDOW_MS } from '../domain/booking';
import type { Clock } from './port/out/clock';
import type { PresenceSession } from '../domain/presence';
import {
  InMemoryBookingRepository,
  InMemoryClassRepository,
  InMemoryPresenceRepository,
  classView,
  makeBooking,
} from './testing/live-class-fakes';

const STARTS_AT = new Date('2026-10-10T00:00:00.000Z');
const WINDOW_END = new Date(STARTS_AT.getTime() + TEACHER_NO_SHOW_WINDOW_MS);

function setup(now: Date, sessions: PresenceSession[] = [], teacherId = 'teacher-1') {
  const classes = new InMemoryClassRepository(classView({ startsAt: STARTS_AT, teacherId }));
  const bookings = new InMemoryBookingRepository([
    makeBooking({ id: 'b1', state: 'confirmed' }),
  ]);
  const presence = new InMemoryPresenceRepository(
    sessions.map((session) => ({ classId: 'cls-1', session })),
  );
  const clock: Clock = { now: () => now };
  return {
    bookings,
    useCase: new MarkTeacherNoShowUseCase(bookings, classes, presence, clock),
  };
}

function teacherSession(joinedAt: Date): PresenceSession {
  return { accountId: 'teacher-1', joinedAt, leftAt: null };
}

describe('MarkTeacherNoShowUseCase (FR-007 / AC-024)', () => {
  it('does not cancel before the 15-minute window closes', async () => {
    const { useCase } = setup(new Date(WINDOW_END.getTime() - 1));
    expect((await useCase.execute({ bookingId: 'b1' })).cancelled).toBe(false);
  });

  it('cancels with reason teacher_no_show once the window closes with no recorded join', async () => {
    const { bookings, useCase } = setup(WINDOW_END);
    const result = await useCase.execute({ bookingId: 'b1' });
    expect(result.cancelled).toBe(true);
    expect(bookings.emitted).toEqual([
      { event: 'booking.cancelled', bookingId: 'b1', reason: 'teacher_no_show' },
    ]);
  });

  it('does not cancel when the Teacher joined within the window', async () => {
    const { useCase } = setup(WINDOW_END, [teacherSession(new Date(STARTS_AT.getTime() + 60_000))]);
    expect((await useCase.execute({ bookingId: 'b1' })).cancelled).toBe(false);
  });

  it('does not cancel when the Teacher joined early and is still in the room', async () => {
    // Early arrival is still attendance; the rule is about the window, not the exact minute.
    const { useCase } = setup(WINDOW_END, [teacherSession(new Date(STARTS_AT.getTime() - 300_000))]);
    expect((await useCase.execute({ bookingId: 'b1' })).cancelled).toBe(false);
  });

  it('cancels when the Teacher only ever joined after the window had closed', async () => {
    const late = new Date(WINDOW_END.getTime() + 60_000);
    const { useCase } = setup(WINDOW_END, [teacherSession(late)]);
    expect((await useCase.execute({ bookingId: 'b1' })).cancelled).toBe(true);
  });

  it('reads the absence from presence, not from who pressed the endpoint', async () => {
    // The old defect: the controller hard-coded `teacherJoinedAt: null`, so a Learner
    // pressing this was itself the evidence. Now the learner's row changes nothing about
    // whether the Teacher attended — only the Teacher's own rows do.
    const withLearnerOnly = setup(WINDOW_END, [
      { accountId: 'l1', joinedAt: STARTS_AT, leftAt: null },
    ]);
    expect((await withLearnerOnly.useCase.execute({ bookingId: 'b1' })).cancelled).toBe(true);

    const beforeWindow = setup(new Date(WINDOW_END.getTime() - 1), [
      { accountId: 'l1', joinedAt: STARTS_AT, leftAt: null },
    ]);
    expect((await beforeWindow.useCase.execute({ bookingId: 'b1' })).cancelled).toBe(false);
    expect(beforeWindow.bookings.emitted).toHaveLength(0);
  });
});
