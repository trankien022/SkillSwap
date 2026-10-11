import { Injectable, Inject, Module, type OnModuleInit } from '@nestjs/common';
import {
  skillEvidenceEventSchema,
  studentVerificationEventSchema,
  walletTransactionCompletedEventSchema,
} from '@skillswap/contracts';
import { ApiConfig } from '../../shared/config/api-config';
import { AppLogger } from '../../shared/logger/app-logger';
import { EventHandlerRegistry, type BusMessage } from '../../shared/messaging/event-handler-registry';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { PermanentHandlerError } from '../../shared/errors';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlModuleStatusReader } from './internal/adapter/out/persistence/sql-module-status-reader';
import { SqlModuleStatusWriter } from './internal/adapter/out/persistence/sql-module-status-writer';
import { SqlClassRepository } from './internal/adapter/out/persistence/sql-class-repository';
import { SqlBookingRepository } from './internal/adapter/out/persistence/sql-booking-repository';
import { SqlBookingPaymentRepository } from './internal/adapter/out/persistence/sql-booking-payment-repository';
import { SqlTeacherTrustProjector } from './internal/adapter/out/persistence/sql-teacher-trust-projector';
import { StatusController } from './internal/adapter/in/web/status.controller';
import { ClassesController } from './internal/adapter/in/web/classes.controller';
import {
  AccountProfileModule,
  PUBLIC_PROFILE_READER,
  type PublicProfileReader,
} from '../account-profile/api';
import { SqlClassListReader } from './internal/adapter/out/persistence/sql-class-list-reader';
import { SqlClassDetailReader } from './internal/adapter/out/persistence/sql-class-detail-reader';
import { SqlMyBookingsReader } from './internal/adapter/out/persistence/sql-my-bookings-reader';
import { AccountProfilePublicTeacherReader } from './internal/adapter/out/account-profile/account-profile-public-teacher-reader';
import { ClassListController } from './internal/adapter/in/web/class-list.controller';
import { ClassDetailController } from './internal/adapter/in/web/class-detail.controller';
import { MyBookingsController } from './internal/adapter/in/web/my-bookings.controller';
import { ListClassesQueryHandler } from './internal/application/query/list-classes.query';
import { GetClassDetailQueryHandler } from './internal/application/query/get-class-detail.query';
import { ListMyBookingsQueryHandler } from './internal/application/query/list-my-bookings.query';
import {
  LIST_MY_BOOKINGS,
  type ListMyBookingsPort,
} from './internal/application/port/in/list-my-bookings';
import {
  LIST_CLASSES,
  type ListClassesPort,
} from './internal/application/port/in/list-classes';
import {
  GET_CLASS_DETAIL,
  type GetClassDetailPort,
} from './internal/application/port/in/get-class-detail';
import {
  CLASS_LIST_READER,
  type ClassListReader,
} from './internal/application/port/out/class-list-reader';
import {
  CLASS_DETAIL_READER,
  type ClassDetailReader,
} from './internal/application/port/out/class-detail-reader';
import {
  MY_BOOKINGS_READER,
  type MyBookingsReader,
} from './internal/application/port/out/my-bookings-reader';
import {
  PUBLIC_TEACHER_READER,
  type PublicTeacherReader,
} from './internal/application/port/out/public-teacher-reader';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { CreateClassUseCase } from './internal/application/create-class.use-case';
import { ProjectTeacherTrustUseCase } from './internal/application/project-teacher-trust.use-case';
import { BookClassUseCase } from './internal/application/book-class.use-case';
import { ConfirmBookingUseCase } from './internal/application/confirm-booking.use-case';
import { RecordBookingPaymentUseCase } from './internal/application/record-booking-payment.use-case';
import { BookingPaymentMismatchError, RECORD_BOOKING_PAYMENT, type RecordBookingPaymentPort } from './internal/application/port/in/record-booking-payment';
import { BOOKING_PAYMENT_REPOSITORY, type BookingPaymentRepository } from './internal/application/port/out/booking-payment-repository';
import { UpdateClassUseCase } from './internal/application/update-class.use-case';
import { CancelClassUseCase } from './internal/application/cancel-class.use-case';
import { MarkTeacherNoShowUseCase } from './internal/application/mark-teacher-no-show.use-case';
import { ExpirePendingBookingsUseCase } from './internal/application/expire-pending-bookings.use-case';
import { RequestRoomAccessUseCase } from './internal/application/request-room-access.use-case';
import { StartClassUseCase } from './internal/application/start-class.use-case';
import { CompleteClassUseCase } from './internal/application/complete-class.use-case';
import { CompleteElapsedClassesUseCase } from './internal/application/complete-elapsed-classes.use-case';
import { PendingHoldSweeper } from './internal/adapter/in/scheduler/pending-hold.sweeper';
import { ClassCompletionSweeper } from './internal/adapter/in/scheduler/class-completion.sweeper';
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
import { START_CLASS, type StartClassPort } from './internal/application/port/in/start-class';
import { COMPLETE_CLASS, type CompleteClassPort } from './internal/application/port/in/complete-class';
import {
  COMPLETE_ELAPSED_CLASSES,
  type CompleteElapsedClassesPort,
} from './internal/application/port/in/complete-elapsed-classes';
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
import {
  TEACHER_TRUST_READER,
  TEACHER_TRUST_WRITER,
  type TeacherTrustReader,
  type TeacherTrustWriter,
} from './internal/application/port/out/teacher-trust';
import { GetModuleStatusQueryHandler } from './internal/application/query/get-module-status.query';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers this module's DataSource pool and the FR-005 trust consumers. */
@Injectable()
export class LiveClassRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly config: ApiConfig,
    private readonly handlers: EventHandlerRegistry,
    @Inject(TEACHER_TRUST_WRITER) private readonly trust: SqlTeacherTrustProjector,
    @Inject(RECORD_BOOKING_PAYMENT) private readonly recordBookingPayment: RecordBookingPaymentPort,
  ) {}

  onModuleInit(): void {
    this.registry.register(MODULE_NAME, SCHEMA, (schema) =>
      createModuleDataSource(this.config, schema),
    );
    // FR-005 / ADR-024: keep a local projection of publish rights so the gate never
    // reads another module's schema.
    const project = new ProjectTeacherTrustUseCase(this.trust);
    for (const eventType of [
      'student.verification.submitted',
      'student.verification.approved',
      'student.verification.rejected',
      'student.verification.revoked',
    ]) {
      this.handlers.register({
        moduleName: MODULE_NAME,
        eventType,
        queue: `live-class.${eventType.replace(/\./g, '-')}`,
        handler: async (message: BusMessage): Promise<void> => {
          await project.onVerification(studentVerificationEventSchema.parse(message.payload));
        },
      });
    }
    for (const eventType of [
      'skill.evidence.submitted',
      'skill.evidence.claimed',
      'skill.evidence.approved',
      'skill.evidence.rejected',
    ]) {
      this.handlers.register({
        moduleName: MODULE_NAME,
        eventType,
        queue: `live-class.${eventType.replace(/\./g, '-')}`,
        handler: async (message: BusMessage): Promise<void> => {
          await project.onSkillEvidence(skillEvidenceEventSchema.parse(message.payload));
        },
      });
    }
    this.handlers.register({
      moduleName: MODULE_NAME,
      eventType: 'wallet.transaction.completed',
      queue: 'live-class.wallet-transaction-completed',
      handler: async (message: BusMessage): Promise<void> => {
        const event = walletTransactionCompletedEventSchema.parse(message.payload);
        if (event.type !== 'booking_payment' || event.direction !== 'debit') {
          return;
        }
        try {
          await this.recordBookingPayment.execute({
            transactionId: event.transactionId,
            bookingId: event.bookingId!,
            accountId: event.accountId,
            amountCredits: event.amountCredits,
            occurredAt: event.occurredAt,
          });
        } catch (error) {
          if (error instanceof BookingPaymentMismatchError) {
            throw new PermanentHandlerError(error.message, { cause: error });
          }
          throw error;
        }
      },
    });
  }
}

/** System wall clock; tests substitute a fixed Clock via the CLOCK token. */
const systemClock: Clock = { now: () => new Date() };

@Module({
  imports: [AccountProfileModule],
  controllers: [
    StatusController,
    ClassesController,
    ClassListController,
    MyBookingsController,
    ClassDetailController,
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
    {
      provide: BOOKING_PAYMENT_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): BookingPaymentRepository =>
        new SqlBookingPaymentRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: RECORD_BOOKING_PAYMENT,
      useFactory: (bookings: BookingPaymentRepository): RecordBookingPaymentPort =>
        new RecordBookingPaymentUseCase(bookings),
      inject: [BOOKING_PAYMENT_REPOSITORY],
    },
    { provide: CLOCK, useValue: systemClock },
    {
      provide: TEACHER_TRUST_READER,
      useFactory: (registry: ModuleDataSourceRegistry): TeacherTrustReader =>
        new SqlTeacherTrustProjector(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: TEACHER_TRUST_WRITER,
      useFactory: (registry: ModuleDataSourceRegistry): TeacherTrustWriter =>
        new SqlTeacherTrustProjector(registry, MODULE_NAME),
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
      provide: CREATE_CLASS,
      useFactory: (
        classes: ClassRepository,
        clock: Clock,
        trust: TeacherTrustReader,
      ): CreateClassPort => new CreateClassUseCase(classes, clock, trust),
      inject: [CLASS_REPOSITORY, CLOCK, TEACHER_TRUST_READER],
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
        trust: TeacherTrustReader,
      ): UpdateClassPort => new UpdateClassUseCase(classes, bookings, clock, trust),
      inject: [CLASS_REPOSITORY, BOOKING_REPOSITORY, CLOCK, TEACHER_TRUST_READER],
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
    {
      provide: START_CLASS,
      useFactory: (classes: ClassRepository): StartClassPort => new StartClassUseCase(classes),
      inject: [CLASS_REPOSITORY],
    },
    {
      provide: COMPLETE_CLASS,
      useFactory: (classes: ClassRepository): CompleteClassPort => new CompleteClassUseCase(classes),
      inject: [CLASS_REPOSITORY],
    },
    {
      provide: COMPLETE_ELAPSED_CLASSES,
      useFactory: (
        classes: ClassRepository,
        bookings: BookingRepository,
        clock: Clock,
      ): CompleteElapsedClassesPort => new CompleteElapsedClassesUseCase(classes, bookings, clock),
      inject: [CLASS_REPOSITORY, BOOKING_REPOSITORY, CLOCK],
    },
    {
      provide: ClassCompletionSweeper,
      useFactory: (complete: CompleteElapsedClassesPort, logger: AppLogger) =>
        new ClassCompletionSweeper(complete, logger),
      inject: [COMPLETE_ELAPSED_CLASSES, AppLogger],
    },
    {
      provide: CLASS_LIST_READER,
      useFactory: (registry: ModuleDataSourceRegistry): ClassListReader =>
        new SqlClassListReader(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: PUBLIC_TEACHER_READER,
      useFactory: (reader: PublicProfileReader): PublicTeacherReader =>
        new AccountProfilePublicTeacherReader(reader),
      inject: [PUBLIC_PROFILE_READER],
    },
    {
      provide: LIST_CLASSES,
      useFactory: (
        classListReader: ClassListReader,
        publicTeacherReader: PublicTeacherReader,
        clock: Clock,
      ): ListClassesPort =>
        new ListClassesQueryHandler(classListReader, publicTeacherReader, clock),
      inject: [CLASS_LIST_READER, PUBLIC_TEACHER_READER, CLOCK],
    },
    {
      provide: CLASS_DETAIL_READER,
      useFactory: (registry: ModuleDataSourceRegistry): ClassDetailReader =>
        new SqlClassDetailReader(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: GET_CLASS_DETAIL,
      useFactory: (
        classDetailReader: ClassDetailReader,
        publicTeacherReader: PublicTeacherReader,
        clock: Clock,
      ): GetClassDetailPort =>
        new GetClassDetailQueryHandler(classDetailReader, publicTeacherReader, clock),
      inject: [CLASS_DETAIL_READER, PUBLIC_TEACHER_READER, CLOCK],
    },
    {
      provide: MY_BOOKINGS_READER,
      useFactory: (registry: ModuleDataSourceRegistry): MyBookingsReader =>
        new SqlMyBookingsReader(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: LIST_MY_BOOKINGS,
      useFactory: (
        myBookingsReader: MyBookingsReader,
        publicTeacherReader: PublicTeacherReader,
        clock: Clock,
        config: ApiConfig,
      ): ListMyBookingsPort =>
        new ListMyBookingsQueryHandler(
          myBookingsReader,
          publicTeacherReader,
          clock,
          config.jitsiOpenMinutes,
        ),
      inject: [MY_BOOKINGS_READER, PUBLIC_TEACHER_READER, CLOCK, ApiConfig],
    },
    LiveClassRegistrar,
  ],
})
export class LiveClassModule {}
