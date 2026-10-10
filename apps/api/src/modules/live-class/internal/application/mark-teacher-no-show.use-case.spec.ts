import { MarkTeacherNoShowUseCase } from './mark-teacher-no-show.use-case';
import { TEACHER_NO_SHOW_WINDOW_MS } from '../domain/booking';
import type { Clock } from './port/out/clock';
import { InMemoryBookingRepository, InMemoryClassRepository, classView, makeBooking } from './testing/live-class-fakes';

const STARTS_AT = new Date('2026-10-10T00:00:00.000Z');
const WINDOW_END = new Date(STARTS_AT.getTime() + TEACHER_NO_SHOW_WINDOW_MS);

function setup(now: Date) {
  const classes = new InMemoryClassRepository(classView({ startsAt: STARTS_AT }));
  const bookings = new InMemoryBookingRepository([
    makeBooking({ id: 'b1', state: 'confirmed' }),
  ]);
  const clock: Clock = { now: () => now };
  return { bookings, useCase: new MarkTeacherNoShowUseCase(bookings, classes, clock) };
}

describe('MarkTeacherNoShowUseCase (FR-007 / AC-024)', () => {
  it('does not cancel before the 15-minute window closes', async () => {
    const { useCase } = setup(new Date(WINDOW_END.getTime() - 1));
    expect((await useCase.execute({ bookingId: 'b1', teacherJoinedAt: null })).cancelled).toBe(false);
  });

  it('cancels with reason teacher_no_show once the window closes with no join', async () => {
    const { bookings, useCase } = setup(WINDOW_END);
    const result = await useCase.execute({ bookingId: 'b1', teacherJoinedAt: null });
    expect(result.cancelled).toBe(true);
    expect(bookings.emitted).toEqual([
      { event: 'booking.cancelled', bookingId: 'b1', reason: 'teacher_no_show' },
    ]);
  });

  it('does not cancel when the teacher joined within the window', async () => {
    const { useCase } = setup(WINDOW_END);
    const joined = new Date(STARTS_AT.getTime() + 60_000);
    expect((await useCase.execute({ bookingId: 'b1', teacherJoinedAt: joined })).cancelled).toBe(false);
  });
});
