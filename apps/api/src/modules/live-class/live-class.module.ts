import { Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { ApiConfig } from '../../shared/config/api-config';
import { AppLogger } from '../../shared/logger/app-logger';
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
import { UpdateClassUseCase } from './internal/application/update-class.use-case';
import { CancelClassUseCase } from './internal/application/cancel-class.use-case';
import { MarkTeacherNoShowUseCase } from './internal/application/mark-teacher-no-show.use-case';
import { ExpirePendingBookingsUseCase } from './internal/application/expire-pending-bookings.use-case';
import { RequestRoomAccessUseCase } from './internal/application/request-room-access.use-case';
import { PendingHoldSweeper } from './internal/adapter/in/scheduler/pending-hold.sweeper';
import { JitsiRoomTokenIssuer } from './internal/adapter/out/jitsi/jitsi-room-token-issuer';
import { SqlRoomIncidentRecorder } from './internal/adapter/out/persistence/sql-room-incident-recorder';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import { CREATE_CLASS, type CreateClassPort } from './internal/application/port/in/create-class';
import { UPDATE_CLASS, type UpdateClassPort } from './internal/application/port/in/update-class';
import { BOOK_CLASS, type BookClassPort } from './internal/application/port/in/book-class';
import { CONFIRM_BOOKING, type ConfirmBookingPort } from './internal/application/port/in/confirm-booking';
import { CANCEL_CLASS, type CancelClassPort } from './internal/application/port/in/cancel-class';
import {
  MARK_TEACHER_NO_SHOW,
  type MarkTeacherNoShowPort,
} from './internal/application/port/in/mark-teacher-no-show';
import {
  EXPIRE_PENDING_BOOKINGS,
  type ExpirePendingBookingsPort,
} from './internal/application/port/in/expire-pending-bookings';
import {
  REQUEST_ROOM_ACCESS,
  type RequestRoomAccessPort,
} from './internal/application/port/in/request-room-access';
import {
  ROOM_TOKEN_ISSUER,
  type RoomTokenIssuer,
} from './internal/application/port/out/room-token-issuer';
import {
  ROOM_INCIDENT_RECORDER,
  type RoomIncidentRecorder,
} from './internal/application/port/out/room-incident-recorder';import { STATUS_READER, type ModuleStatusReader } from './internal/application/port/out/module-status-reader';
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
    {
      provide: UPDATE_CLASS,
      useFactory: (
        classes: ClassRepository,
        bookings: BookingRepository,
        clock: Clock,
      ): UpdateClassPort => new UpdateClassUseCase(classes, bookings, clock),
      inject: [CLASS_REPOSITORY, BOOKING_REPOSITORY, CLOCK],
    },
    {
      provide: CANCEL_CLASS,
      useFactory: (classes: ClassRepository, bookings: BookingRepository): CancelClassPort =>
        new CancelClassUseCase(classes, bookings),
      inject: [CLASS_REPOSITORY, BOOKING_REPOSITORY],
    },
    {
      provide: MARK_TEACHER_NO_SHOW,
      useFactory: (
        bookings: BookingRepository,
        classes: ClassRepository,
        clock: Clock,
      ): MarkTeacherNoShowPort => new MarkTeacherNoShowUseCase(bookings, classes, clock),
      inject: [BOOKING_REPOSITORY, CLASS_REPOSITORY, CLOCK],
    },
    {
      provide: EXPIRE_PENDING_BOOKINGS,
      useFactory: (bookings: BookingRepository, clock: Clock) =>
        new ExpirePendingBookingsUseCase(bookings, clock),
      inject: [BOOKING_REPOSITORY, CLOCK],
    },
    {
      provide: ROOM_TOKEN_ISSUER,
      useFactory: (config: ApiConfig): RoomTokenIssuer =>
        new JitsiRoomTokenIssuer(config.jitsiAppId, config.jitsiAppSecret, config.jitsiTokenTtlSeconds),
      inject: [ApiConfig],
    },
    {
      provide: ROOM_INCIDENT_RECORDER,
      useFactory: (registry: ModuleDataSourceRegistry): RoomIncidentRecorder =>
        new SqlRoomIncidentRecorder(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: REQUEST_ROOM_ACCESS,
      useFactory: (
        bookings: BookingRepository,
        classes: ClassRepository,
        tokens: RoomTokenIssuer,
        incidents: RoomIncidentRecorder,
        clock: Clock,
        config: ApiConfig,
      ): RequestRoomAccessPort =>
        new RequestRoomAccessUseCase(
          bookings,
          classes,
          tokens,
          incidents,
          clock,
          config.jitsiDomain,
          config.jitsiOpenMinutes,
        ),
      inject: [
        BOOKING_REPOSITORY,
        CLASS_REPOSITORY,
        ROOM_TOKEN_ISSUER,
        ROOM_INCIDENT_RECORDER,
        CLOCK,
        ApiConfig,
      ],
    },
    {
      provide: PendingHoldSweeper,
      useFactory: (expire: ExpirePendingBookingsPort, logger: AppLogger) =>
        new PendingHoldSweeper(expire, logger),
      inject: [EXPIRE_PENDING_BOOKINGS, AppLogger],
    },
    LiveClassRegistrar,
  ],
})
export class LiveClassModule {}
