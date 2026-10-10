import { CancelClassUseCase, NotClassOwnerError, ClassAlreadyCancelledError } from './cancel-class.use-case';
import { ClassNotFoundError } from './book-class.use-case';
import { InMemoryBookingRepository, InMemoryClassRepository, classView } from './testing/live-class-fakes';

describe('CancelClassUseCase (FR-007 / AC-022)', () => {
  it('cancels every active booking and marks the class cancelled', async () => {
    const classes = new InMemoryClassRepository(classView({ teacherId: 'teacher-1' }));
    const bookings = new InMemoryBookingRepository([
      { ...baseBooking('b1', 'pending') },
      { ...baseBooking('b2', 'confirmed') },
      { ...baseBooking('b3', 'cancelled') },
    ]);
    const result = await new CancelClassUseCase(classes, bookings).execute({
      classId: 'cls-1',
      teacherId: 'teacher-1',
    });
    expect(result).toEqual({ classCancelled: true, bookingsCancelled: 2 });
    expect(classes.cancelled).toEqual(['cls-1']);
    expect(bookings.emitted.map((e) => ({ id: e.bookingId, reason: e.reason }))).toEqual([
      { id: 'b1', reason: 'class_cancelled' },
      { id: 'b2', reason: 'class_cancelled' },
    ]);
  });

  it('rejects a non-owner and an unknown class', async () => {
    const classes = new InMemoryClassRepository(classView({ teacherId: 'teacher-1' }));
    const useCase = new CancelClassUseCase(classes, new InMemoryBookingRepository());
    await expect(useCase.execute({ classId: 'cls-1', teacherId: 'other' })).rejects.toThrow(
      NotClassOwnerError,
    );
    await expect(useCase.execute({ classId: 'missing', teacherId: 'teacher-1' })).rejects.toThrow(
      ClassNotFoundError,
    );
  });

  it('rejects an already-cancelled class', async () => {
    const classes = new InMemoryClassRepository(classView({ state: 'cancelled' }));
    const useCase = new CancelClassUseCase(classes, new InMemoryBookingRepository());
    await expect(useCase.execute({ classId: 'cls-1', teacherId: 'teacher-1' })).rejects.toThrow(
      ClassAlreadyCancelledError,
    );
  });
});

function baseBooking(id: string, state: 'pending' | 'confirmed' | 'cancelled') {
  return {
    id,
    classId: 'cls-1',
    learnerId: `st-${id}`,
    state,
    priceCredits: 100,
    idempotencyKey: `key-${id}`,
    createdAt: new Date('2026-10-10T00:00:00.000Z'),
    expiresAt: new Date('2026-10-10T00:15:00.000Z'),
  };
}
