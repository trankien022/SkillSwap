import { completionOutcome } from '../domain/class';
import { evaluateRoomIdle } from '../domain/presence';
import type {
  CompleteElapsedClassesPort,
  CompleteElapsedClassesResult,
} from './port/in/complete-elapsed-classes';
import type { BookingRepository } from './port/out/booking-repository';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import type { PresenceRepository } from './port/out/presence-repository';

/**
 * FR-020 / ADR-021 / AC-035: sweeps classes into an audited outcome.
 *
 * Two ways in, both producing the same `class.completed` / `class.cancelled` event:
 *
 * 1. **Elapsed** — past the scheduled end: Completed (`scheduled_end`) when the Teacher
 *    held the class, Cancelled (`teacher_no_show`) when FR-007 recorded a no-show.
 * 2. **Idle** — started but not yet due to end, and everyone left the room for the grace
 *    period: Completed (`room_idle`). The rule itself is `evaluateRoomIdle`; this class
 *    only supplies the evidence and the transition.
 *
 * Ordering matters. Elapsed classes are handled first so a class that is *both* past its
 * end and empty completes on `scheduled_end` — the honest basis — rather than racing the
 * two paths. Whatever the order, `completeAndEmit` is atomic and idempotent, so exactly
 * one transition and one event happen per class.
 */
export class CompleteElapsedClassesUseCase implements CompleteElapsedClassesPort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly bookings: BookingRepository,
    private readonly presence: PresenceRepository,
    private readonly clock: Clock,
  ) {}

  async execute(): Promise<CompleteElapsedClassesResult> {
    const now = this.clock.now();
    let completed = 0;
    let cancelled = 0;

    for (const classView of await this.classes.findAwaitingCompletion(now)) {
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

    for (const classView of await this.classes.findInProgressBeforeEnd(now)) {
      // A no-show class must never be "completed because the room emptied": the room
      // being empty is the consequence of the no-show, not a session that happened.
      if (await this.bookings.hasTeacherNoShow(classView.id)) {
        continue;
      }
      const sessions = await this.presence.listSessions(classView.id);
      if (!evaluateRoomIdle({ startsAt: classView.startsAt, now, sessions }).idle) {
        continue;
      }
      const result = await this.classes.completeAndEmit(classView.id, 'room_idle');
      if (result.completed) {
        completed += 1;
      }
    }

    return { completed, cancelled };
  }
}
