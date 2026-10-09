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
import { SqlWalletRepository } from './internal/adapter/out/persistence/sql-wallet-repository';
import { SqlTopUpIntentRepository } from './internal/adapter/out/persistence/sql-top-up-intent-repository';
import { MockPaymentGateway } from './internal/adapter/out/payment/mock-payment-gateway';
import { StatusController } from './internal/adapter/in/web/status.controller';
import { WalletController } from './internal/adapter/in/web/wallet.controller';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { RecordBookingConfirmedUseCase } from './internal/application/record-booking-confirmed.use-case';
import { InitiateTopUpUseCase } from './internal/application/initiate-top-up.use-case';
import { HandleTopUpCallbackUseCase } from './internal/application/handle-top-up-callback.use-case';
import { GetWalletBalanceUseCase } from './internal/application/get-wallet-balance.use-case';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import { INITIATE_TOP_UP } from './internal/application/port/in/initiate-top-up';
import { HANDLE_TOP_UP_CALLBACK } from './internal/application/port/in/handle-top-up-callback';
import { GET_WALLET_BALANCE } from './internal/application/port/in/get-wallet-balance';
import {
  RECORD_BOOKING_CONFIRMED,
  type RecordBookingConfirmedPort,
} from './internal/application/port/in/record-booking-confirmed';
import {
  LEDGER_ENTRY_WRITER,
  type LedgerEntryWriter,
} from './internal/application/port/out/ledger-entry-writer';
import { WALLET_REPOSITORY, type WalletRepository } from './internal/application/port/out/wallet-repository';
import {
  TOP_UP_INTENT_REPOSITORY,
  type TopUpIntentRepository,
} from './internal/application/port/out/top-up-intent-repository';
import { PAYMENT_GATEWAY, type PaymentGateway } from './internal/application/port/out/payment-gateway';
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
  controllers: [StatusController, WalletController],
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
    {
      provide: WALLET_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): WalletRepository =>
        new SqlWalletRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: TOP_UP_INTENT_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlTopUpIntentRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    { provide: PAYMENT_GATEWAY, useFactory: (): PaymentGateway => new MockPaymentGateway() },
    {
      provide: INITIATE_TOP_UP,
      useFactory: (intents: TopUpIntentRepository, gateway: PaymentGateway) =>
        new InitiateTopUpUseCase(intents, gateway),
      inject: [TOP_UP_INTENT_REPOSITORY, PAYMENT_GATEWAY],
    },
    {
      provide: HANDLE_TOP_UP_CALLBACK,
      useFactory: (intents: TopUpIntentRepository, wallets: WalletRepository, gateway: PaymentGateway) =>
        new HandleTopUpCallbackUseCase(intents, wallets, gateway.provider),
      inject: [TOP_UP_INTENT_REPOSITORY, WALLET_REPOSITORY, PAYMENT_GATEWAY],
    },
    {
      provide: GET_WALLET_BALANCE,
      useFactory: (wallets: WalletRepository) => new GetWalletBalanceUseCase(wallets),
      inject: [WALLET_REPOSITORY],
    },
    WalletLedgerRegistrar,
  ],
})
export class WalletLedgerModule {}
