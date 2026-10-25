import { Injectable, Inject, Module, type OnModuleInit } from '@nestjs/common';
import { ApiConfig } from '../../shared/config/api-config';
import { EventHandlerRegistry, type BusMessage } from '../../shared/messaging/event-handler-registry';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import {
  StudentVerificationModule,
  VERIFICATION_SUMMARY_READER,
  type VerificationSummaryReader,
} from '../student-verification/api';
import {
  SkillVerificationModule,
  EVIDENCE_SUMMARY_READER,
  type EvidenceSummaryReader,
} from '../skill-verification/api';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlAdminAuditEventRepository } from './internal/adapter/out/persistence/sql-admin-audit-event-repository';
import { SqlOutboxDeadLetterRepository } from './internal/adapter/out/persistence/sql-outbox-dead-letter-repository';
import { AuditLogController } from './internal/adapter/in/web/audit-log.controller';
import { AdminDashboardController } from './internal/adapter/in/web/admin-dashboard.controller';
import { OutboxDeadLetterController } from './internal/adapter/in/web/outbox-dead-letter.controller';
import { AUDITED_EVENT_TYPE_LIST } from './internal/application/audit-actions';
import { RecordAdminAuditEventUseCase } from './internal/application/record-admin-audit-event.use-case';
import { ReplayOutboxDeadLetterUseCase } from './internal/application/replay-outbox-dead-letter.use-case';
import { LIST_AUDIT_LOG, type ListAuditLogPort } from './internal/application/port/in/list-audit-log';
import {
  LIST_OUTBOX_DEAD_LETTERS,
  REPLAY_OUTBOX_DEAD_LETTER,
  type ListOutboxDeadLettersPort,
  type ReplayOutboxDeadLetterPort,
} from './internal/application/port/in/outbox-dead-letters';
import {
  OUTBOX_DEAD_LETTER_REPOSITORY,
  type OutboxDeadLetterRepository,
} from './internal/application/port/out/outbox-dead-letter-repository';
import { ListOutboxDeadLettersQueryHandler } from './internal/application/query/list-outbox-dead-letters.query';
import {
  GET_ADMIN_DASHBOARD,
  type GetAdminDashboardPort,
} from './internal/application/port/in/get-admin-dashboard';
import {
  ADMIN_AUDIT_EVENT_REPOSITORY,
  type AdminAuditEventRepository,
} from './internal/application/port/out/admin-audit-event-repository';
import { ListAuditLogQueryHandler } from './internal/application/query/list-audit-log.query';
import { GetAdminDashboardQueryHandler } from './internal/application/query/get-admin-dashboard.query';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers this module's DataSource pool and its FR-015 audit consumers (ARCHITECTURE.md §5). */
@Injectable()
export class AdminOperationRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly config: ApiConfig,
    private readonly handlers: EventHandlerRegistry,
    @Inject(ADMIN_AUDIT_EVENT_REPOSITORY) private readonly audit: AdminAuditEventRepository,
  ) {}

  onModuleInit(): void {
    this.registry.register(MODULE_NAME, SCHEMA, (schema) =>
      createModuleDataSource(this.config, schema),
    );

    // FR-015 / ADR-034: one consumer per audited event. The use case is created here rather than
    // injected so the module has a single wiring point for the mapping and its repository.
    const useCase = new RecordAdminAuditEventUseCase(this.audit);
    for (const eventType of AUDITED_EVENT_TYPE_LIST) {
      this.handlers.register({
        moduleName: MODULE_NAME,
        eventType,
        queue: `admin-operation.audit-${eventType.replace(/\./g, '-')}`,
        handler: async (message: BusMessage): Promise<void> => {
          // The registrar is allowed to know the shared message shape; the use case takes a
          // structural subset so `application/` stays free of `shared` (ADR-009).
          await useCase.execute({
            id: message.id,
            eventType: message.eventType,
            payload: message.payload,
          });
        },
      });
    }
  }
}

@Module({
  // FR-015 / ADR-008/ADR-012: the dashboard composes counts by asking each owning module, so it
  // imports them and injects the readers they export rather than reading their schemas.
  imports: [StudentVerificationModule, SkillVerificationModule],
  controllers: [AuditLogController, AdminDashboardController, OutboxDeadLetterController],
  providers: [
    {
      provide: ADMIN_AUDIT_EVENT_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlAdminAuditEventRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    // FR-015 / ADR-013 Amendment A (W2 C3): the dead-letter inbox reads the shared outbox
    // tables across every module, which is the one cross-schema read this module is allowed.
    {
      provide: OUTBOX_DEAD_LETTER_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlOutboxDeadLetterRepository(registry),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: LIST_OUTBOX_DEAD_LETTERS,
      useFactory: (deadLetters: OutboxDeadLetterRepository): ListOutboxDeadLettersPort =>
        new ListOutboxDeadLettersQueryHandler(deadLetters),
      inject: [OUTBOX_DEAD_LETTER_REPOSITORY],
    },
    {
      provide: REPLAY_OUTBOX_DEAD_LETTER,
      useFactory: (
        deadLetters: OutboxDeadLetterRepository,
        audit: AdminAuditEventRepository,
      ): ReplayOutboxDeadLetterPort =>
        new ReplayOutboxDeadLetterUseCase(deadLetters, audit),
      inject: [OUTBOX_DEAD_LETTER_REPOSITORY, ADMIN_AUDIT_EVENT_REPOSITORY],
    },
    {
      provide: LIST_AUDIT_LOG,
      useFactory: (audit: AdminAuditEventRepository): ListAuditLogPort =>
        new ListAuditLogQueryHandler(audit),
      inject: [ADMIN_AUDIT_EVENT_REPOSITORY],
    },
    {
      provide: GET_ADMIN_DASHBOARD,
      useFactory: (
        verifications: VerificationSummaryReader,
        evidence: EvidenceSummaryReader,
        audit: AdminAuditEventRepository,
      ): GetAdminDashboardPort =>
        new GetAdminDashboardQueryHandler(verifications, evidence, audit),
      inject: [VERIFICATION_SUMMARY_READER, EVIDENCE_SUMMARY_READER, ADMIN_AUDIT_EVENT_REPOSITORY],
    },
    AdminOperationRegistrar,
  ],
})
export class AdminOperationModule {}
