import { ClassNotFoundError } from './book-class.use-case';
import type {
  CancelClassCommand,
  CancelClassPort,
  CancelClassResult,
} from './port/in/cancel-class';
import type { BookingRepository } from './port/out/booking-repository';
import type { ClassRepository } from './port/out/class-repository';

export class NotClassOwnerError extends Error {
  constructor() {
    super('Only the class teacher may cancel this class');
    this.name = 'NotClassOwnerError';
  }
}

export class ClassAlreadyCancelledError extends Error {
  constructor() {
    super('Class is already cancelled');
    this.name = 'ClassAlreadyCancelledError';
  }
}

/**
 * FR-007 / AC-022 (ADR-019): the Teacher cancels a class. Every active booking
 * is cancelled (each emits `booking.cancelled`, so confirmed ones are refunded
 * by the wallet) and the class is marked cancelled — in that order so no seat
 * survives the class.
 */
export class CancelClassUseCase implements CancelClassPort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly bookings: BookingRepository,
  ) {}

  async execute(command: CancelClassCommand): Promise<CancelClassResult> {
    const classView = await this.classes.findById(command.classId);
    if (classView === null) {
      throw new ClassNotFoundError(command.classId);
    }
    if (classView.teacherId !== command.teacherId) {
      throw new NotClassOwnerError();
    }
    if (classView.state === 'cancelled') {
      throw new ClassAlreadyCancelledError();
    }

    const active = await this.bookings.findActiveByClass(command.classId);
    let cancelled = 0;
    for (const booking of active) {
      const outcome = await this.bookings.cancelAndEmit(booking.id, 'class_cancelled');
      if (outcome.cancelled) {
        cancelled += 1;
      }
    }
    await this.classes.markCancelled(command.classId);
    return { classCancelled: true, bookingsCancelled: cancelled };
  }
}
