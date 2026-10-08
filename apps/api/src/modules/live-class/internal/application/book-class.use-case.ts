import { assertBookable } from '../domain/booking';
import type {
  BookClassCommand,
  BookClassPort,
  BookClassResult,
  BookingResource,
} from './port/in/book-class';
import type { BookingRepository } from './port/out/booking-repository';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';

/** FR-007 / API-005: create a pending booking that holds a seat. */
export class BookClassUseCase implements BookClassPort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly bookings: BookingRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: BookClassCommand): Promise<BookClassResult> {
    const replay = await this.bookings.findByIdempotencyKey(command.idempotencyKey);
    if (replay !== null) {
      return { booking: toResource(replay), created: false };
    }

    const classView = await this.classes.findById(command.classId);
    if (classView === null) {
      throw new ClassNotFoundError(command.classId);
    }

    const now = this.clock.now();
    const outcome = await this.bookings.createWithSeatGuard(
      {
        classId: command.classId,
        learnerId: command.learnerId,
        state: 'pending',
        priceCredits: classView.priceCredits,
        idempotencyKey: command.idempotencyKey,
      },
      (seatRows) => {
        assertBookable({
          classView: {
            state: classView.state,
            startsAt: classView.startsAt,
            durationMinutes: classView.durationMinutes,
            capacity: classView.capacity,
            teacherId: classView.teacherId,
          },
          learnerId: command.learnerId,
          existingBookings: seatRows,
          now,
        });
      },
    );

    return { booking: toResource(outcome.booking), created: outcome.created };
  }
}

export class ClassNotFoundError extends Error {
  constructor(classId: string) {
    super(`Class not found: ${classId}`);
    this.name = 'ClassNotFoundError';
  }
}

function toResource(booking: {
  id: string;
  classId: string;
  learnerId: string;
  state: string;
  priceCredits: number;
  createdAt: Date;
}): BookingResource {
  return {
    bookingId: booking.id,
    classId: booking.classId,
    learnerId: booking.learnerId,
    state: booking.state,
    priceCredits: booking.priceCredits,
    createdAt: booking.createdAt.toISOString(),
  };
}
