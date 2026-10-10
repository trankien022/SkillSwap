import { Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { ApiConfig } from '../../shared/config/api-config';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlModuleStatusReader } from './internal/adapter/out/persistence/sql-module-status-reader';
import { SqlModuleStatusWriter } from './internal/adapter/out/persistence/sql-module-status-writer';
import { SqlVerificationRepository } from './internal/adapter/out/persistence/sql-verification-repository';
import { StatusController } from './internal/adapter/in/web/status.controller';
import { StudentVerificationController } from './internal/adapter/in/web/student-verification.controller';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { SubmitStudentVerificationUseCase } from './internal/application/submit-student-verification.use-case';
import { DecideStudentVerificationUseCase } from './internal/application/decide-student-verification.use-case';
import { GetMyVerificationQueryHandler } from './internal/application/get-my-verification.query';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import { SUBMIT_STUDENT_VERIFICATION } from './internal/application/port/in/submit-student-verification';
import { DECIDE_STUDENT_VERIFICATION } from './internal/application/port/in/decide-student-verification';
import { GET_MY_VERIFICATION } from './internal/application/port/in/get-my-verification';
import { STATUS_READER, type ModuleStatusReader } from './internal/application/port/out/module-status-reader';
import { STATUS_WRITER, type ModuleStatusWriter } from './internal/application/port/out/module-status-writer';
import {
  VERIFICATION_REPOSITORY,
  type VerificationRepository,
} from './internal/application/port/out/verification-repository';
import { CLOCK, type Clock } from './internal/application/port/out/clock';
import { GetModuleStatusQueryHandler } from './internal/application/query/get-module-status.query';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers this module's DataSource pool on the shared registry (ARCHITECTURE.md §5). */
@Injectable()
export class StudentVerificationRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly config: ApiConfig,
  ) {}

  onModuleInit(): void {
    this.registry.register(MODULE_NAME, SCHEMA, (schema) =>
      createModuleDataSource(this.config, schema),
    );
  }
}

@Module({
  controllers: [StatusController, StudentVerificationController],
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
    { provide: CLOCK, useFactory: (): Clock => ({ now: () => new Date() }) },
    {
      provide: VERIFICATION_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): VerificationRepository =>
        new SqlVerificationRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: SUBMIT_STUDENT_VERIFICATION,
      useFactory: (verifications: VerificationRepository, clock: Clock) =>
        new SubmitStudentVerificationUseCase(verifications, clock),
      inject: [VERIFICATION_REPOSITORY, CLOCK],
    },
    {
      provide: DECIDE_STUDENT_VERIFICATION,
      useFactory: (verifications: VerificationRepository, clock: Clock) =>
        new DecideStudentVerificationUseCase(verifications, clock),
      inject: [VERIFICATION_REPOSITORY, CLOCK],
    },
    {
      provide: GET_MY_VERIFICATION,
      useFactory: (verifications: VerificationRepository) =>
        new GetMyVerificationQueryHandler(verifications),
      inject: [VERIFICATION_REPOSITORY],
    },
    StudentVerificationRegistrar,
  ],
})
export class StudentVerificationModule {}
