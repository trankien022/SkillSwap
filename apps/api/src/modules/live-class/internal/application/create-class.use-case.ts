import { publishClass } from '../domain/class';
import type {
  ClassResource,
  CreateClassCommand,
  CreateClassPort,
  CreateClassResult,
} from './port/in/create-class';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';

/**
 * Publishes a class (FR-005 / API-004).
 *
 * TODO(FR-005): enforce that the Teacher is verified and approved for every
 * class skill. Verification lives in other modules and is out of scope for
 * FR-007, so the check is intentionally deferred.
 */
export class CreateClassUseCase implements CreateClassPort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateClassCommand): Promise<CreateClassResult> {
    const published = publishClass(
      {
        teacherId: command.teacherId,
        startsAt: new Date(command.startsAt),
        durationMinutes: command.durationMinutes,
        priceCredits: command.priceCredits,
        capacity: command.capacity,
      },
      this.clock.now(),
    );

    const stored = await this.classes.insert({
      teacherId: published.teacherId,
      state: published.state,
      startsAt: published.startsAt,
      durationMinutes: published.durationMinutes,
      priceCredits: published.priceCredits,
      capacity: published.capacity,
      description: command.description,
      skillIds: command.skillIds,
    });

    return toResource(stored);
  }
}

function toResource(stored: {
  id: string;
  teacherId: string;
  state: string;
  startsAt: Date;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
}): ClassResource {
  return {
    id: stored.id,
    teacherId: stored.teacherId,
    state: stored.state,
    startsAt: stored.startsAt.toISOString(),
    durationMinutes: stored.durationMinutes,
    priceCredits: stored.priceCredits,
    capacity: stored.capacity,
  };
}
