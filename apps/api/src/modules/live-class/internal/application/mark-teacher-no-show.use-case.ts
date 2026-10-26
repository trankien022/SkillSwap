import { isTeacherNoShow } from '../domain/booking';
import type {
  MarkTeacherNoShowCommand,
  MarkTeacherNoShowPort,
  MarkTeacherNoShowResult,
} from './port/in/mark-teacher-no-show';
import type { BookingRepository } from './port/out/booking-repository';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import type { PresenceRepository } from './port/out/presence-repository';

/**
 * FR-007 / AC-024 (ADR-019): cancels a confirmed booking when the Teacher did not
 * join within the first 15 minutes of the class, which refunds the Learner via the
 * `booking.cancelled` event.
 *
 * The join evidence is read from `class_presence`, never supplied by the caller.
 * Before AC-035 the controller hard-coded `teacherJoinedAt: null`, so a Learner
 * pressing this endpoint was, on its own, enough to trigger a refund. Now the only
 * thing that can produce a no-show verdict is a confirmed absence of the Teacher
 * from the room's own record.
 */
export class MarkTeacherNoShowUseCase implements MarkTeacherNoShowPort {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly classes: ClassRepository,
    private readonly presence: PresenceRepository,
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
    const teacherJoinedAt = await this.presence.findTeacherFirstJoin(
      classView.id,
      classView.teacherId,
    );
    if (!isTeacherNoShow({ startsAt: classView.startsAt }, teacherJoinedAt, this.clock.now())) {
      return { cancelled: false };
    }
    const outcome = await this.bookings.cancelAndEmit(booking.id, 'teacher_no_show');
    return { cancelled: outcome.cancelled };
  }
}
