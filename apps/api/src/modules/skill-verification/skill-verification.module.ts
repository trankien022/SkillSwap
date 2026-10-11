import { Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { studentVerificationEventSchema } from '@skillswap/contracts';
import { ApiConfig } from '../../shared/config/api-config';
import { EventHandlerRegistry, type BusMessage } from '../../shared/messaging/event-handler-registry';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlModuleStatusReader } from './internal/adapter/out/persistence/sql-module-status-reader';
import { SqlModuleStatusWriter } from './internal/adapter/out/persistence/sql-module-status-writer';
import { SqlSkillRepository, SqlProfileSkillRepository } from './internal/adapter/out/persistence/sql-skill-repository';
import { SqlSkillEvidenceRepository } from './internal/adapter/out/persistence/sql-skill-evidence-repository';
import { SqlVerifierRepository } from './internal/adapter/out/persistence/sql-verifier-repository';
import { SqlVerifiedStudentProjector } from './internal/adapter/out/persistence/sql-verified-student-projector';
import { SystemClock } from './internal/adapter/out/crypto/system-clock';
import { StatusController } from './internal/adapter/in/web/status.controller';
import {
  ProfileSkillController,
  SkillEvidenceController,
} from './internal/adapter/in/web/skill-evidence.controller';
import { VerifierController, SkillEvidenceDecisionController } from './internal/adapter/in/web/verifier.controller';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { SubmitSkillEvidenceUseCase } from './internal/application/submit-skill-evidence.use-case';
import { ChangeVerifierStatusUseCase } from './internal/application/change-verifier-status.use-case';
import { ClaimSkillEvidenceUseCase } from './internal/application/claim-skill-evidence.use-case';
import { DecideSkillEvidenceUseCase } from './internal/application/decide-skill-evidence.use-case';
import { ListVerifierQueueQueryHandler } from './internal/application/list-verifier-queue.query';
import { VerifierAuthority } from './internal/application/verifier-authority';
import { GetMyProfileSkillsQueryHandler } from './internal/application/query/get-my-profile-skills.query';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import { SUBMIT_SKILL_EVIDENCE } from './internal/application/port/in/submit-skill-evidence';
import {
  GET_MY_PROFILE_SKILLS,
  type GetMyProfileSkillsPort,
} from './internal/application/port/in/get-my-profile-skills';
import {
  CHANGE_VERIFIER_STATUS,
  type ChangeVerifierStatusPort,
} from './internal/application/port/in/change-verifier-status';
import {
  CLAIM_SKILL_EVIDENCE,
  type ClaimSkillEvidencePort,
} from './internal/application/port/in/claim-skill-evidence';
import {
  DECIDE_SKILL_EVIDENCE,
  type DecideSkillEvidencePort,
} from './internal/application/port/in/decide-skill-evidence';
import {
  LIST_VERIFIER_QUEUE,
  type ListVerifierQueuePort,
} from './internal/application/port/in/list-verifier-queue';
import { STATUS_READER, type ModuleStatusReader } from './internal/application/port/out/module-status-reader';
import { STATUS_WRITER, type ModuleStatusWriter } from './internal/application/port/out/module-status-writer';
import { CLOCK, type Clock } from './internal/application/port/out/clock';
import { SKILL_REPOSITORY, type SkillRepository } from './internal/application/port/out/skill-repository';
import {
  PROFILE_SKILL_REPOSITORY,
  SKILL_EVIDENCE_REPOSITORY,
  VERIFIER_REPOSITORY,
  type ProfileSkillRepository,
  type SkillEvidenceRepository,
  type VerifierRepository,
} from './internal/application/port/out/skill-evidence-repository';
import {
  VERIFIED_STUDENT_READER,
  type VerifiedStudentReader,
} from './internal/application/port/out/verified-student-reader';
import { GetModuleStatusQueryHandler } from './internal/application/query/get-module-status.query';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers this module's DataSource pool and the FR-003 verified-student consumer. */
@Injectable()
export class SkillVerificationRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly config: ApiConfig,
    private readonly handlers: EventHandlerRegistry,
    @Inject(VERIFIED_STUDENT_READER) private readonly projector: SqlVerifiedStudentProjector,
  ) {}

  onModuleInit(): void {
    this.registry.register(MODULE_NAME, SCHEMA, (schema) =>
      createModuleDataSource(this.config, schema),
    );
    // FR-003 / ADR-024: keep a local projection of student verification status so
    // evidence submission can require a verified student without a cross-schema read.
    for (const eventType of [
      'student.verification.submitted',
      'student.verification.approved',
      'student.verification.rejected',
      'student.verification.revoked',
    ]) {
      this.handlers.register({
        moduleName: MODULE_NAME,
        eventType,
        queue: `skill-verification.${eventType.replace(/\./g, '-')}`,
        handler: async (message: BusMessage): Promise<void> => {
          const event = studentVerificationEventSchema.parse(message.payload);
          await this.projector.upsert(event);
        },
      });
    }
  }
}

@Module({
  controllers: [
    StatusController,
    SkillEvidenceController,
    ProfileSkillController,
    VerifierController,
    SkillEvidenceDecisionController,
  ],
  providers: [
    {
      provide: STATUS_READER,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlModuleStatusReader(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: STATUS_WRITER,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlModuleStatusWriter(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    { provide: CLOCK, useFactory: (): Clock => new SystemClock() },
    {
      provide: SKILL_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): SkillRepository =>
        new SqlSkillRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: PROFILE_SKILL_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): ProfileSkillRepository =>
        new SqlProfileSkillRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: SKILL_EVIDENCE_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): SkillEvidenceRepository =>
        new SqlSkillEvidenceRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: VERIFIED_STUDENT_READER,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlVerifiedStudentProjector(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: VERIFIER_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): VerifierRepository =>
        new SqlVerifierRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: VerifierAuthority,
      useFactory: (verifiers: VerifierRepository) => new VerifierAuthority(verifiers),
      inject: [VERIFIER_REPOSITORY],
    },
    {
      provide: ADVANCE_STATUS,
      useFactory: (reader: ModuleStatusReader, writer: ModuleStatusWriter) =>
        new AdvanceStatusUseCase(reader, writer),
      inject: [STATUS_READER, STATUS_WRITER],
    },
    {
      provide: SUBMIT_SKILL_EVIDENCE,
      useFactory: (
        skills: SkillRepository,
        profileSkills: ProfileSkillRepository,
        evidence: SkillEvidenceRepository,
        verifiedStudents: VerifiedStudentReader,
        clock: Clock,
      ) => new SubmitSkillEvidenceUseCase(skills, profileSkills, evidence, verifiedStudents, clock),
      inject: [
        SKILL_REPOSITORY,
        PROFILE_SKILL_REPOSITORY,
        SKILL_EVIDENCE_REPOSITORY,
        VERIFIED_STUDENT_READER,
        CLOCK,
      ],
    },
    {
      provide: GET_MY_PROFILE_SKILLS,
      useFactory: (profileSkills: ProfileSkillRepository): GetMyProfileSkillsPort =>
        new GetMyProfileSkillsQueryHandler(profileSkills),
      inject: [PROFILE_SKILL_REPOSITORY],
    },
    {
      provide: CHANGE_VERIFIER_STATUS,
      useFactory: (verifiers: VerifierRepository): ChangeVerifierStatusPort =>
        new ChangeVerifierStatusUseCase(verifiers),
      inject: [VERIFIER_REPOSITORY],
    },
    {
      provide: LIST_VERIFIER_QUEUE,
      useFactory: (
        evidence: SkillEvidenceRepository,
        verifiers: VerifierRepository,
      ): ListVerifierQueuePort => new ListVerifierQueueQueryHandler(evidence, verifiers),
      inject: [SKILL_EVIDENCE_REPOSITORY, VERIFIER_REPOSITORY],
    },
    {
      provide: CLAIM_SKILL_EVIDENCE,
      useFactory: (
        evidence: SkillEvidenceRepository,
        profileSkills: ProfileSkillRepository,
        skills: SkillRepository,
        authority: VerifierAuthority,
        clock: Clock,
      ): ClaimSkillEvidencePort =>
        new ClaimSkillEvidenceUseCase(evidence, profileSkills, skills, authority, clock),
      inject: [
        SKILL_EVIDENCE_REPOSITORY,
        PROFILE_SKILL_REPOSITORY,
        SKILL_REPOSITORY,
        VerifierAuthority,
        CLOCK,
      ],
    },
    {
      provide: DECIDE_SKILL_EVIDENCE,
      useFactory: (
        evidence: SkillEvidenceRepository,
        profileSkills: ProfileSkillRepository,
        skills: SkillRepository,
        authority: VerifierAuthority,
        clock: Clock,
      ): DecideSkillEvidencePort =>
        new DecideSkillEvidenceUseCase(evidence, profileSkills, skills, authority, clock),
      inject: [
        SKILL_EVIDENCE_REPOSITORY,
        PROFILE_SKILL_REPOSITORY,
        SKILL_REPOSITORY,
        VerifierAuthority,
        CLOCK,
      ],
    },
    {
      provide: GET_MODULE_STATUS,
      useFactory: (reader: ModuleStatusReader) => new GetModuleStatusQueryHandler(reader),
      inject: [STATUS_READER],
    },
    SkillVerificationRegistrar,
  ],
})
export class SkillVerificationModule {}
