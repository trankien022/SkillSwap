import { isTeacherNoShow } from '../domain/booking';
import type {
  MarkTeacherNoShowCommand,
  MarkTeacherNoShowPort,
  MarkTeacherNoShowResult,
} from './port/in/mark-teacher-no-show';
import type { BookingRepository } from './port/out/booking-repository';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';

/**
 * FR-007 / AC-024 (ADR-019): cancels a confirmed booking when the Teacher did
 * not join within the first 15 minutes of the class, which refunds the Learner
 * via the `booking.cancelled` event. Detection of the join is supplied by the
 * caller (FR-011 room access); this guards the window and the state.
 */
export class MarkTeacherNoShowUseCase implements MarkTeacherNoShowPort {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly classes: ClassRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: MarkTeacherNoShowCommand): Promise<MarkTeacherNoShowResult> {
    const booking = await this.bookings.findById(command.bookingId);
    if (booking === null || booking.state !== 'confirmed') {
      return { cancelled: false };
    }
    const classView = await this.classes.findById(booking.classId);
    if (classView === null) {
      return { cancelled: false };
    }
    if (!isTeacherNoShow({ startsAt: classView.startsAt }, command.teacherJoinedAt, this.clock.now())) {
      return { cancelled: false };
    }
    const outcome = await this.bookings.cancelAndEmit(booking.id, 'teacher_no_show');
    return { cancelled: outcome.cancelled };
  }
}
