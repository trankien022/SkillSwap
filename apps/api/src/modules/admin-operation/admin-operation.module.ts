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
import { SqlModuleStatusReader } from './internal/adapter/out/persistence/sql-module-status-reader';
import { SqlModuleStatusWriter } from './internal/adapter/out/persistence/sql-module-status-writer';
import { AuditLogController } from './internal/adapter/in/web/audit-log.controller';
import { AdminDashboardController } from './internal/adapter/in/web/admin-dashboard.controller';
import { StatusController } from './internal/adapter/in/web/status.controller';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { AUDITED_EVENT_TYPE_LIST } from './internal/application/audit-actions';
import { RecordAdminAuditEventUseCase } from './internal/application/record-admin-audit-event.use-case';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import { LIST_AUDIT_LOG, type ListAuditLogPort } from './internal/application/port/in/list-audit-log';
import {
  GET_ADMIN_DASHBOARD,
  type GetAdminDashboardPort,
} from './internal/application/port/in/get-admin-dashboard';
import {
  ADMIN_AUDIT_EVENT_REPOSITORY,
  type AdminAuditEventRepository,
} from './internal/application/port/out/admin-audit-event-repository';
import { STATUS_READER, type ModuleStatusReader } from './internal/application/port/out/module-status-reader';
import { STATUS_WRITER, type ModuleStatusWriter } from './internal/application/port/out/module-status-writer';
import { GetModuleStatusQueryHandler } from './internal/application/query/get-module-status.query';
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
  controllers: [StatusController, AuditLogController, AdminDashboardController],
  providers: [
    {
      provide: ADMIN_AUDIT_EVENT_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlAdminAuditEventRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
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
    {
      provide: ADVANCE_STATUS,
      useFactory: (reader: ModuleStatusReader, writer: ModuleStatusWriter) =>
        new AdvanceStatusUseCase(reader, writer),
      inject: [STATUS_READER, STATUS_WRITER],
    },
    {
      provide: GET_MODULE_STATUS,
      useFactory: (reader: ModuleStatusReader) => new GetModuleStatusQueryHandler(reader),
      inject: [STATUS_READER],
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
