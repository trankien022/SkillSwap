import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { StartClassUseCase } from './start-class.use-case';
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

describe('CompleteClassUseCase (FR-020) — removed by ADR-021 Amendment A', () => {
  it('no longer exists as a module', () => {
    // AC-035: the capability is gone, not guarded. If someone re-adds the use case,
    // this spec fails and the decision must be re-taken against ADR-021 rather than
    // the guard quietly disappearing.
    expect(existsSync(join(__dirname, 'complete-class.use-case.ts'))).toBe(false);
    expect(existsSync(join(__dirname, 'port/in/complete-class.ts'))).toBe(false);
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
