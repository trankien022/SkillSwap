import { UpdateClassUseCase } from './update-class.use-case';
import { ClassLockedError } from '../domain/class';
import { NotClassOwnerError } from './cancel-class.use-case';
import { ClassNotFoundError } from './book-class.use-case';
import type { Clock } from './port/out/clock';
import { InMemoryBookingRepository, InMemoryClassRepository, makeBooking } from './testing/live-class-fakes';

const NOW = new Date('2026-10-10T00:00:00.000Z');
const clock: Clock = { now: () => NOW };

describe('UpdateClassUseCase (FR-007 / AC-017)', () => {
  it('edits a class before its first confirmed booking', async () => {
    const classes = new InMemoryClassRepository();
    const bookings = new InMemoryBookingRepository();
    const result = await new UpdateClassUseCase(classes, bookings, clock).execute({
      classId: 'cls-1',
      teacherId: 'teacher-1',
      capacity: 5,
    });
    expect(result.capacity).toBe(5);
    expect(classes.updated?.capacity).toBe(5);
  });

  it('locks the class once a booking is confirmed', async () => {
    const classes = new InMemoryClassRepository();
    const bookings = new InMemoryBookingRepository([makeBooking({ id: 'b1', state: 'confirmed' })]);
    await expect(
      new UpdateClassUseCase(classes, bookings, clock).execute({
        classId: 'cls-1',
        teacherId: 'teacher-1',
        priceCredits: 200,
      }),
    ).rejects.toThrow(ClassLockedError);
  });

  it('rejects a non-owner and an unknown class', async () => {
    const classes = new InMemoryClassRepository();
    const bookings = new InMemoryBookingRepository();
    const useCase = new UpdateClassUseCase(classes, bookings, clock);
    await expect(useCase.execute({ classId: 'cls-1', teacherId: 'other', capacity: 2 })).rejects.toThrow(
      NotClassOwnerError,
    );
    await expect(useCase.execute({ classId: 'missing', teacherId: 'teacher-1', capacity: 2 })).rejects.toThrow(
      ClassNotFoundError,
    );
  });

  it('refuses to move the start time into the past', async () => {
    const classes = new InMemoryClassRepository();
    const bookings = new InMemoryBookingRepository();
    await expect(
      new UpdateClassUseCase(classes, bookings, clock).execute({
        classId: 'cls-1',
        teacherId: 'teacher-1',
        startsAt: new Date(NOW.getTime() - 1000).toISOString(),
      }),
    ).rejects.toThrow();
  });
});
