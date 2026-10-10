import { InvalidStartTimeError, assertClassEditable } from '../domain/class';
import type { ClassResource } from './port/in/create-class';
import type { UpdateClassCommand, UpdateClassPort } from './port/in/update-class';
import type { ClassRepository, PersistedClass } from './port/out/class-repository';
import type { BookingRepository } from './port/out/booking-repository';
import type { Clock } from './port/out/clock';
import { ClassNotFoundError } from './book-class.use-case';
import { NotClassOwnerError } from './cancel-class.use-case';

export class InvalidClassEditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidClassEditError';
  }
}

/**
 * FR-007 / AC-017 (ADR-019): edits a class only while it has no confirmed
 * booking; once one is confirmed, `assertClassEditable` raises `ClassLockedError`
 * and the change is refused. Reuses the publish validation for edited facts.
 */
export class UpdateClassUseCase implements UpdateClassPort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly bookings: BookingRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: UpdateClassCommand): Promise<ClassResource> {
    const current = await this.classes.findById(command.classId);
    if (current === null) {
      throw new ClassNotFoundError(command.classId);
    }
    if (current.teacherId !== command.teacherId) {
      throw new NotClassOwnerError();
    }
    if (current.state === 'cancelled' || current.state === 'completed') {
      throw new InvalidClassEditError(`Cannot edit a ${current.state} class`);
    }

    const confirmed = await this.bookings.countByClassAndState(command.classId, 'confirmed');
    assertClassEditable(command.classId, confirmed);

    const startsAt = command.startsAt === undefined ? current.startsAt : new Date(command.startsAt);
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= this.clock.now().getTime()) {
      throw new InvalidStartTimeError('Class must start in the future');
    }

    const updated = await this.classes.update(command.classId, {
      skillIds: command.skillIds ?? current.skillIds,
      description: command.description ?? current.description,
      startsAt,
      durationMinutes: command.durationMinutes ?? current.durationMinutes,
      priceCredits: command.priceCredits ?? current.priceCredits,
      capacity: command.capacity ?? current.capacity,
    });
    return toResource(updated);
  }
}

function toResource(stored: PersistedClass): ClassResource {
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
