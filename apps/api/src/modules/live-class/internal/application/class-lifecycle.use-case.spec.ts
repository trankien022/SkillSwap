import { StartClassUseCase } from './start-class.use-case';
import { CompleteClassUseCase } from './complete-class.use-case';
import { CompleteElapsedClassesUseCase } from './complete-elapsed-classes.use-case';
import { ClassNotFoundError } from './book-class.use-case';
import { NotClassOwnerError } from './cancel-class.use-case';
import type { Clock } from './port/out/clock';
import {
  InMemoryBookingRepository,
  InMemoryClassRepository,
  classView,
  makeBooking,
} from './testing/live-class-fakes';

const NOW = new Date('2026-10-12T11:00:00.000Z');
const clock: Clock = { now: () => NOW };

describe('StartClassUseCase (FR-020)', () => {
  it('starts a published class owned by the teacher', async () => {
    const classes = new InMemoryClassRepository(classView({ teacherId: 't1', state: 'published' }));
    const result = await new StartClassUseCase(classes).execute({ classId: 'cls-1', teacherId: 't1' });
    expect(result.started).toBe(true);
  });

  it('rejects a non-owner and unknown class', async () => {
    const classes = new InMemoryClassRepository(classView({ teacherId: 't1' }));
    const useCase = new StartClassUseCase(classes);
    await expect(useCase.execute({ classId: 'cls-1', teacherId: 'other' })).rejects.toThrow(NotClassOwnerError);
    await expect(useCase.execute({ classId: 'missing', teacherId: 't1' })).rejects.toThrow(ClassNotFoundError);
  });
});

describe('CompleteClassUseCase (FR-020)', () => {
  it('ends a class with basis teacher_ended', async () => {
    const classes = new InMemoryClassRepository(classView({ teacherId: 't1', state: 'in_progress' }));
    const result = await new CompleteClassUseCase(classes).execute({ classId: 'cls-1', teacherId: 't1' });
    expect(result).toEqual({ completed: true, basis: 'teacher_ended' });
    expect(classes.completedBasis).toBe('teacher_ended');
  });
});

describe('CompleteElapsedClassesUseCase (FR-020 / ADR-021)', () => {
  it('completes an elapsed class the teacher held (basis scheduled_end)', async () => {
    const classes = new InMemoryClassRepository();
    classes.awaiting = [
      { id: 'cls-1', teacherId: 't1', state: 'in_progress', startsAt: NOW, durationMinutes: 60 },
    ];
    classes.confirmedBookingIds = ['b1'];
    const bookings = new InMemoryBookingRepository([makeBooking({ id: 'b1', state: 'confirmed' })]);
    const result = await new CompleteElapsedClassesUseCase(classes, bookings, clock).execute();
    expect(result).toEqual({ completed: 1, cancelled: 0 });
    expect(classes.completedBasis).toBe('scheduled_end');
  });

  it('cancels an elapsed class when the teacher no-showed', async () => {
    const classes = new InMemoryClassRepository();
    classes.awaiting = [
      { id: 'cls-1', teacherId: 't1', state: 'in_progress', startsAt: NOW, durationMinutes: 60 },
    ];
    const bookings = new InMemoryBookingRepository([makeBooking({ id: 'b1', state: 'confirmed' })]);
    await bookings.cancelAndEmit('b1', 'teacher_no_show');
    const result = await new CompleteElapsedClassesUseCase(classes, bookings, clock).execute();
    expect(result).toEqual({ completed: 0, cancelled: 1 });
    expect(classes.lastCancelReason).toBe('teacher_no_show');
  });

  it('does nothing when no class has elapsed', async () => {
    const classes = new InMemoryClassRepository();
    const bookings = new InMemoryBookingRepository();
    const result = await new CompleteElapsedClassesUseCase(classes, bookings, clock).execute();
    expect(result).toEqual({ completed: 0, cancelled: 0 });
  });
});
