import { Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { bookingCancelledSchema, bookingConfirmedSchema, classCompletedSchema } from '@skillswap/contracts';
import { ApiConfig } from '../../shared/config/api-config';
import { AppLogger } from '../../shared/logger/app-logger';
import { EventHandlerRegistry, type BusMessage } from '../../shared/messaging/event-handler-registry';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlWalletRepository } from './internal/adapter/out/persistence/sql-wallet-repository';
import { SqlWalletReader } from './internal/adapter/out/persistence/sql-wallet-reader';
import { SqlTopUpIntentRepository } from './internal/adapter/out/persistence/sql-top-up-intent-repository';
import { SepayPaymentGateway } from './internal/adapter/out/payment/sepay-payment-gateway';
import { SepayRestOrderClient } from './internal/adapter/out/payment/sepay-rest-order-client';
import { TopUpReconciliationSweeper } from './internal/adapter/in/scheduler/topup-reconciliation.sweeper';
import { WalletController } from './internal/adapter/in/web/wallet.controller';
import { RecordBookingConfirmedUseCase } from './internal/application/record-booking-confirmed.use-case';
import { RefundCancelledBookingUseCase } from './internal/application/refund-cancelled-booking.use-case';
import { ReleaseIncomeUseCase } from './internal/application/release-income.use-case';
import { ReleaseCompletedClassUseCase } from './internal/application/release-completed-class.use-case';
import { InitiateTopUpUseCase } from './internal/application/initiate-top-up.use-case';
import { HandleTopUpCallbackUseCase } from './internal/application/handle-top-up-callback.use-case';
import { GetWalletBalanceUseCase } from './internal/application/get-wallet-balance.use-case';
import { GetTopUpIntentUseCase } from './internal/application/get-top-up-intent.use-case';
import { GetWalletHistoryQueryHandler } from './internal/application/get-wallet-history.query';
import { GET_WALLET_HISTORY } from './internal/application/port/in/get-wallet-history';
import { WALLET_READER, type WalletReader } from './internal/application/port/out/wallet-reader';
import { INITIATE_TOP_UP } from './internal/application/port/in/initiate-top-up';
import { HANDLE_TOP_UP_CALLBACK } from './internal/application/port/in/handle-top-up-callback';
import type { HandleTopUpCallbackPort } from './internal/application/port/in/handle-top-up-callback';
import { GET_WALLET_BALANCE } from './internal/application/port/in/get-wallet-balance';
import { GET_TOP_UP_INTENT } from './internal/application/port/in/get-top-up-intent';
import {
  RECORD_BOOKING_CONFIRMED,
  type RecordBookingConfirmedPort,
} from './internal/application/port/in/record-booking-confirmed';
import { RELEASE_INCOME } from './internal/application/port/in/release-income';
import {
  REFUND_CANCELLED_BOOKING,
  type RefundCancelledBookingPort,
} from './internal/application/port/in/refund-cancelled-booking';
import {
  RELEASE_COMPLETED_CLASS,
  type ReleaseCompletedClassPort,
} from './internal/application/port/in/release-completed-class';
import { WALLET_REPOSITORY, type WalletRepository } from './internal/application/port/out/wallet-repository';
import {
  TOP_UP_INTENT_REPOSITORY,
  type TopUpIntentRepository,
} from './internal/application/port/out/top-up-intent-repository';
import { PAYMENT_GATEWAY, type PaymentGateway } from './internal/application/port/out/payment-gateway';
import {
  SEPAY_ORDER_CLIENT,
  type SepayOrderClient,
} from './internal/application/port/out/sepay-order-client';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers the wallet DataSource pool and the booking.confirmed consumer. */
@Injectable()
export class WalletLedgerRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly config: ApiConfig,
    private readonly handlers: EventHandlerRegistry,
    @Inject(RECORD_BOOKING_CONFIRMED) private readonly recordBooking: RecordBookingConfirmedPort,
    @Inject(REFUND_CANCELLED_BOOKING) private readonly refundBooking: RefundCancelledBookingPort,
    @Inject(RELEASE_COMPLETED_CLASS) private readonly releaseClass: ReleaseCompletedClassPort,
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
        if (event.settled) {
          return;
        }
        await this.recordBooking.execute(event);
      },
    });
    this.handlers.register({
      moduleName: MODULE_NAME,
      eventType: 'booking.cancelled',
      queue: 'wallet-ledger.booking-cancelled',
      handler: async (message: BusMessage): Promise<void> => {
        const event = bookingCancelledSchema.parse(message.payload);
        await this.refundBooking.execute(event);
      },
    });
    this.handlers.register({
      moduleName: MODULE_NAME,
      eventType: 'class.completed',
      queue: 'wallet-ledger.class-completed',
      handler: async (message: BusMessage): Promise<void> => {
        const event = classCompletedSchema.parse(message.payload);
        await this.releaseClass.execute(event);
      },
    });
  }
}

@Module({
  controllers: [WalletController],
  providers: [
    {
      provide: RECORD_BOOKING_CONFIRMED,
      useFactory: (wallets: WalletRepository) => new RecordBookingConfirmedUseCase(wallets),
      inject: [WALLET_REPOSITORY],
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
    {
      provide: PAYMENT_GATEWAY,
      useFactory: (config: ApiConfig): PaymentGateway => new SepayPaymentGateway(config),
      inject: [ApiConfig],
    },
    {
      provide: INITIATE_TOP_UP,
      useFactory: (intents: TopUpIntentRepository, gateway: PaymentGateway, config: ApiConfig) =>
        // FR-008: the configured return URL is both the fallback destination
        // and the base of the allow-list for the client's per-request URL; the
        // extra origins let the payer's own client (dev or prod) opt in.
        new InitiateTopUpUseCase(
          intents,
          gateway,
          config.sepayReturnUrl,
          config.sepayReturnUrlAllowedOrigins,
        ),
      inject: [TOP_UP_INTENT_REPOSITORY, PAYMENT_GATEWAY, ApiConfig],
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
    {
      provide: GET_TOP_UP_INTENT,
      useFactory: (intents: TopUpIntentRepository) => new GetTopUpIntentUseCase(intents),
      inject: [TOP_UP_INTENT_REPOSITORY],
    },
    {
      provide: WALLET_READER,
      useFactory: (registry: ModuleDataSourceRegistry): WalletReader =>
        new SqlWalletReader(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: GET_WALLET_HISTORY,
      useFactory: (reader: WalletReader) => new GetWalletHistoryQueryHandler(reader),
      inject: [WALLET_READER],
    },
    {
      provide: RELEASE_INCOME,
      useFactory: (wallets: WalletRepository) => new ReleaseIncomeUseCase(wallets),
      inject: [WALLET_REPOSITORY],
    },
    {
      provide: REFUND_CANCELLED_BOOKING,
      useFactory: (wallets: WalletRepository) => new RefundCancelledBookingUseCase(wallets),
      inject: [WALLET_REPOSITORY],
    },
    {
      provide: RELEASE_COMPLETED_CLASS,
      useFactory: (wallets: WalletRepository) => new ReleaseCompletedClassUseCase(wallets),
      inject: [WALLET_REPOSITORY],
    },
    {
      provide: SEPAY_ORDER_CLIENT,
      useFactory: (config: ApiConfig): SepayOrderClient => new SepayRestOrderClient(config),
      inject: [ApiConfig],
    },
    {
      provide: TopUpReconciliationSweeper,
      useFactory: (
        intents: TopUpIntentRepository,
        orders: SepayOrderClient,
        applyCallback: HandleTopUpCallbackPort,
        config: ApiConfig,
        logger: AppLogger,
      ) => new TopUpReconciliationSweeper(intents, orders, applyCallback, config, logger),
      inject: [
        TOP_UP_INTENT_REPOSITORY,
        SEPAY_ORDER_CLIENT,
        HANDLE_TOP_UP_CALLBACK,
        ApiConfig,
        AppLogger,
      ],
    },
    WalletLedgerRegistrar,
  ],
})
export class WalletLedgerModule {}
