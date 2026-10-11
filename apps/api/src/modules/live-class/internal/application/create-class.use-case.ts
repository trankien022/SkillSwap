import { publishClass } from '../domain/class';
import { assertPublishable, type RequiredClassSkill } from '../domain/publish-policy';
import type {
  ClassResource,
  CreateClassCommand,
  CreateClassPort,
  CreateClassResult,
} from './port/in/create-class';
import type { ClassRepository } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import type { TeacherTrustReader } from './port/out/teacher-trust';

/**
 * Publishes a class (FR-005 / API-004 / AC-002).
 *
 * The **publish gate**: the Teacher must be a verified student and approved (at the
 * required level) for **every** class skill (SR-BR-002/BR-008), read from this module's
 * local trust projection (ADR-024) — never a cross-schema read. Publishing is not gated
 * on a role (ADR-030). Pricing is pure self-price (OQ-002); `publishClass` validates
 * duration/capacity/price/start.
 */
export class CreateClassUseCase implements CreateClassPort {
  constructor(
    private readonly classes: ClassRepository,
    private readonly clock: Clock,
    private readonly teacherTrust: TeacherTrustReader,
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

    const trust = await this.teacherTrust.read(command.teacherId);
    const classSkills: RequiredClassSkill[] = command.skillIds.map((skillId) => ({ skillId }));
    assertPublishable({ teacherId: command.teacherId, teacherTrust: trust, classSkills });

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
