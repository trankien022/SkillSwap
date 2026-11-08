import { classFormatOf, publishClass } from '../domain/class';
import { assertPublishable, type RequiredClassSkill } from '../domain/publish-policy';
import type {
  ClassResource,
  CreateClassCommand,
  CreateClassPort,
  CreateClassResult,
} from './port/in/create-class';
import type { ClassRepository, PersistedClass } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import type { AccountTrustReader } from './port/out/account-trust';

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
    private readonly teacherTrust: AccountTrustReader,
  ) {}

  async execute(command: CreateClassCommand): Promise<CreateClassResult> {
    const published = publishClass(
      {
        teacherId: command.teacherId,
        title: command.title,
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

    // B2: the level is a by-product of the gate above, not a new check. `approvedLevel` is the same
    // projection `assertPublishable` just consulted, so this cannot report a level the gate did not
    // accept. Read from the class's first skill because that is the skill the gate orders first and
    // the only one the approval projection can answer for without guessing (multi-skill classes keep
    // the first skill's level — the gate required *every* skill approved, so it is the floor).
    const level = trust.approvedLevel(command.skillIds[0]);

    const stored = await this.classes.insert({
      teacherId: published.teacherId,
      state: published.state,
      title: published.title,
      level,
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

function toResource(stored: PersistedClass): ClassResource {
  return {
    id: stored.id,
    teacherId: stored.teacherId,
    state: stored.state,
    title: stored.title,
    level: stored.level,
    format: classFormatOf(stored.capacity),
    startsAt: stored.startsAt.toISOString(),
    durationMinutes: stored.durationMinutes,
    priceCredits: stored.priceCredits,
    capacity: stored.capacity,
  };
}
