import { Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { ApiConfig } from '../../shared/config/api-config';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlModuleStatusReader } from './internal/adapter/out/persistence/sql-module-status-reader';
import { SqlModuleStatusWriter } from './internal/adapter/out/persistence/sql-module-status-writer';
import { SqlClassRepository } from './internal/adapter/out/persistence/sql-class-repository';
import { SqlBookingRepository } from './internal/adapter/out/persistence/sql-booking-repository';
import { StatusController } from './internal/adapter/in/web/status.controller';
import { ClassesController } from './internal/adapter/in/web/classes.controller';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { CreateClassUseCase } from './internal/application/create-class.use-case';
import { BookClassUseCase } from './internal/application/book-class.use-case';
import { ConfirmBookingUseCase } from './internal/application/confirm-booking.use-case';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import { CREATE_CLASS, type CreateClassPort } from './internal/application/port/in/create-class';
import { BOOK_CLASS, type BookClassPort } from './internal/application/port/in/book-class';
import { CONFIRM_BOOKING, type ConfirmBookingPort } from './internal/application/port/in/confirm-booking';
import { STATUS_READER, type ModuleStatusReader } from './internal/application/port/out/module-status-reader';
import { STATUS_WRITER, type ModuleStatusWriter } from './internal/application/port/out/module-status-writer';
import { CLASS_REPOSITORY, type ClassRepository } from './internal/application/port/out/class-repository';
import { BOOKING_REPOSITORY, type BookingRepository } from './internal/application/port/out/booking-repository';
import { CLOCK, type Clock } from './internal/application/port/out/clock';
import { GetModuleStatusQueryHandler } from './internal/application/query/get-module-status.query';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers this module's DataSource pool on the shared registry (ARCHITECTURE.md §5). */
@Injectable()
export class LiveClassRegistrar implements OnModuleInit {
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

/** System wall clock; tests substitute a fixed Clock via the CLOCK token. */
const systemClock: Clock = { now: () => new Date() };

@Module({
  controllers: [StatusController, ClassesController],
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
      provide: CLASS_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlClassRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: BOOKING_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlBookingRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    { provide: CLOCK, useValue: systemClock },
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
      provide: CREATE_CLASS,
      useFactory: (classes: ClassRepository, clock: Clock): CreateClassPort =>
        new CreateClassUseCase(classes, clock),
      inject: [CLASS_REPOSITORY, CLOCK],
    },
    {
      provide: BOOK_CLASS,
      useFactory: (
        classes: ClassRepository,
        bookings: BookingRepository,
        clock: Clock,
      ): BookClassPort => new BookClassUseCase(classes, bookings, clock),
      inject: [CLASS_REPOSITORY, BOOKING_REPOSITORY, CLOCK],
    },
    {
      provide: CONFIRM_BOOKING,
      useFactory: (bookings: BookingRepository): ConfirmBookingPort =>
        new ConfirmBookingUseCase(bookings),
      inject: [BOOKING_REPOSITORY],
    },
    LiveClassRegistrar,
  ],
})
export class LiveClassModule {}
