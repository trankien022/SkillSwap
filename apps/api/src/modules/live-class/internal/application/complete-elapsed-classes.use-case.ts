import { completionOutcome } from '../domain/class';
import type {
  CompleteElapsedClassesPort,
  CompleteElapsedClassesResult,
} from './port/in/complete-elapsed-classes';
import type { BookingRepository } from './port/out/booking-repository';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';

/**
 * FR-020 / ADR-021: sweeps classes past their scheduled end into an audited
 * outcome — Completed (basis `scheduled_end`) when the Teacher held the class,
 * or Cancelled (`teacher_no_show`) when FR-007 recorded a teacher no-show. Every
 * transition is atomic and idempotent, so a repeated sweep is a no-op.
 */
export class CompleteElapsedClassesUseCase implements CompleteElapsedClassesPort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly bookings: BookingRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<CompleteElapsedClassesResult> {
    const elapsed = await this.classes.findAwaitingCompletion(this.clock.now());
    let completed = 0;
    let cancelled = 0;
    for (const classView of elapsed) {
      const hasNoShow = await this.bookings.hasTeacherNoShow(classView.id);
      const outcome = completionOutcome(hasNoShow);
      if (outcome.state === 'completed') {
        const result = await this.classes.completeAndEmit(classView.id, outcome.basis!);
        if (result.completed) {
          completed += 1;
        }
      } else {
        const result = await this.classes.cancelWithReason(classView.id, outcome.reason!);
        if (result.cancelled) {
          cancelled += 1;
        }
      }
    }
    return { completed, cancelled };
  }
}
