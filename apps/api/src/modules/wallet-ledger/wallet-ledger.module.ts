import { Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { bookingConfirmedSchema } from '@skillswap/contracts';
import { ApiConfig } from '../../shared/config/api-config';
import { EventHandlerRegistry, type BusMessage } from '../../shared/messaging/event-handler-registry';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlLedgerEntryWriter } from './internal/adapter/out/persistence/sql-ledger-entry-writer';
import { SqlModuleStatusReader } from './internal/adapter/out/persistence/sql-module-status-reader';
import { SqlModuleStatusWriter } from './internal/adapter/out/persistence/sql-module-status-writer';
import { StatusController } from './internal/adapter/in/web/status.controller';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { RecordBookingConfirmedUseCase } from './internal/application/record-booking-confirmed.use-case';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import {
  RECORD_BOOKING_CONFIRMED,
  type RecordBookingConfirmedPort,
} from './internal/application/port/in/record-booking-confirmed';
import {
  LEDGER_ENTRY_WRITER,
  type LedgerEntryWriter,
} from './internal/application/port/out/ledger-entry-writer';
import { STATUS_READER, type ModuleStatusReader } from './internal/application/port/out/module-status-reader';
import { STATUS_WRITER, type ModuleStatusWriter } from './internal/application/port/out/module-status-writer';
import { GetModuleStatusQueryHandler } from './internal/application/query/get-module-status.query';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers the wallet DataSource pool and the booking.confirmed consumer. */
@Injectable()
export class WalletLedgerRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly config: ApiConfig,
    private readonly handlers: EventHandlerRegistry,
    @Inject(RECORD_BOOKING_CONFIRMED) private readonly recordBooking: RecordBookingConfirmedPort,
  ) {}

  onModuleInit(): void {
    this.registry.register(MODULE_NAME, SCHEMA, (schema) =>
      createModuleDataSource(this.config, schema),
    );
    this.handlers.register({
      moduleName: MODULE_NAME,
      eventType: 'booking.confirmed',
      queue: 'wallet-ledger.booking-confirmed',
      handler: async (message: BusMessage): Promise<void> => {
        const event = bookingConfirmedSchema.parse(message.payload);
        await this.recordBooking.execute(event);
      },
    });
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
    {
      provide: LEDGER_ENTRY_WRITER,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlLedgerEntryWriter(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: RECORD_BOOKING_CONFIRMED,
      useFactory: (ledger: LedgerEntryWriter) => new RecordBookingConfirmedUseCase(ledger),
      inject: [LEDGER_ENTRY_WRITER],
    },
    WalletLedgerRegistrar,
  ],
})
export class WalletLedgerModule {}
