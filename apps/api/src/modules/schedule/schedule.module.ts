import { Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { ApiConfig } from '../../shared/config/api-config';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlModuleStatusReader } from './internal/adapter/out/persistence/sql-module-status-reader';
import { SqlModuleStatusWriter } from './internal/adapter/out/persistence/sql-module-status-writer';
import { StatusController } from './internal/adapter/in/web/status.controller';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import { STATUS_READER, type ModuleStatusReader } from './internal/application/port/out/module-status-reader';
import { STATUS_WRITER, type ModuleStatusWriter } from './internal/application/port/out/module-status-writer';
import { GetModuleStatusQueryHandler } from './internal/application/query/get-module-status.query';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers this module's DataSource pool on the shared registry (ARCHITECTURE.md §5). */
@Injectable()
export class ScheduleRegistrar implements OnModuleInit {
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
  controllers: [StatusController],
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
    ScheduleRegistrar,
  ],
})
export class ScheduleModule {}
