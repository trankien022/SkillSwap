import type { ClassRosterView } from '@skillswap/contracts';
import type {
  GetClassRosterPort,
  GetClassRosterQuery,
} from '../port/in/get-class-roster';
import type { ClassRepository } from '../port/out/class-repository';
import type { ClassRosterReader } from '../port/out/class-roster-reader';
import type { PublicTeacherReader } from '../port/out/public-teacher-reader';

const NEUTRAL_LEARNER_NAME = 'Learner';

/**
 * A caller who is not the class teacher must not learn that the class exists. The class detail
 * read takes the same position (`get-class-detail.query.ts`), so a stranger gets the same 404
 * from both rather than a 403 that confirms the id.
 */
export class ClassRosterNotFoundError extends Error {
  constructor(classId: string) {
    super(`Class not found: ${classId}`);
    this.name = 'ClassRosterNotFoundError';
  }
}

/**
 * FR-011 / ADR-040: CQRS read for the teacher's roster, used by the teacher classroom panel.
 *
 * Names come from the `account-profile` facade (`PublicProfileReader` via
 * `PublicTeacherReader`), not from a cross-schema join — ADR-014 keeps each schema owned by
 * its own role, so the roster cannot select from `account_profile` directly.
 */
export class GetClassRosterQueryHandler implements GetClassRosterPort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly roster: ClassRosterReader,
    private readonly profiles: PublicTeacherReader,
    private readonly clock: { now(): Date },
  ) {}

  async execute(query: GetClassRosterQuery): Promise<ClassRosterView> {
    const classView = await this.classes.findById(query.classId);
    if (classView === null || classView.teacherId !== query.callerId) {
      throw new ClassRosterNotFoundError(query.classId);
    }

    const seats = await this.roster.findActiveSeats({
      classId: classView.id,
      now: this.clock.now(),
    });

    const names = new Map<string, string>();
    if (seats.length > 0) {
      const uniqueIds = Array.from(new Set(seats.map((seat) => seat.learnerId)));
      const profiles = await this.profiles.readMany(uniqueIds);
      for (const profile of profiles) {
        if (profile.displayName.trim() !== '') {
          names.set(profile.id, profile.displayName.trim());
        }
      }
    }

    return {
      classId: classView.id,
      capacity: classView.capacity,
      entries: seats.map((seat) => ({
        bookingId: seat.bookingId,
        learnerId: seat.learnerId,
        // A neutral fallback, never the id: an id here would leak into the teacher's UI, which
        // is exactly the raw-UUID defect found during flow testing.
        displayName: names.get(seat.learnerId) ?? NEUTRAL_LEARNER_NAME,
        state: seat.state,
        createdAt: seat.createdAt.toISOString(),
      })),
    };
  }
}
