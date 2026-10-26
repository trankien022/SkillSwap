import { Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import {
  CLASS_STARTING_SOON_EVENT,
  bookingCancelledSchema,
  bookingConfirmedSchema,
  classStartingSoonSchema,
  studentVerificationEventSchema,
  walletTransactionCompletedEventSchema,
} from '@skillswap/contracts';
import { ApiConfig } from '../../shared/config/api-config';
import { AppLogger } from '../../shared/logger/app-logger';
import { EventHandlerRegistry, type BusMessage } from '../../shared/messaging/event-handler-registry';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlAccountRepository } from './internal/adapter/out/persistence/sql-account-repository';
import { SqlSuspendedAccountReader } from './internal/adapter/out/persistence/sql-suspended-account-reader';
import { SqlCredentialRepository } from './internal/adapter/out/persistence/sql-credential-repository';
import { SqlSessionRepository } from './internal/adapter/out/persistence/sql-session-repository';
import { SqlVerificationStatusProjector } from './internal/adapter/out/persistence/sql-verification-status-projector';
import { ScryptPasswordHasher } from './internal/adapter/out/crypto/scrypt-password-hasher';
import { NodeTokenService } from './internal/adapter/out/crypto/node-token-service';
import { SystemClock } from './internal/adapter/out/crypto/system-clock';
import { AuthController } from './internal/adapter/in/web/auth.controller';
import { AccountLockController } from './internal/adapter/in/web/account-lock.controller';
import { RegisterAccountUseCase } from './internal/application/register-account.use-case';
import { LoginUseCase } from './internal/application/login.use-case';
import { RefreshSessionUseCase } from './internal/application/refresh-session.use-case';
import { LogoutUseCase } from './internal/application/logout.use-case';
import { GetMeUseCase } from './internal/application/get-me.use-case';
import { ProjectVerificationStatusUseCase } from './internal/application/project-verification-status.use-case';
import { REGISTER_ACCOUNT } from './internal/application/port/in/register-account';
import { LOGIN } from './internal/application/port/in/login';
import { REFRESH_SESSION } from './internal/application/port/in/refresh-session';
import { LOGOUT } from './internal/application/port/in/logout';
import { GET_ME } from './internal/application/port/in/get-me';
import {
  ACCOUNT_LOCK_REPOSITORY,
  ACCOUNT_REPOSITORY,
  type AccountLockRepository,
  type AccountRepository,
} from './internal/application/port/out/account-repository';
import { SUSPENDED_ACCOUNT_READER, type SuspendedAccountReader } from './api/suspended-account-reader';
import { LockAccountUseCase } from './internal/application/lock-account.use-case';
import { LOCK_ACCOUNT_PORT, type LockAccountPort } from './internal/application/port/in/lock-account';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepository,
} from './internal/application/port/out/credential-repository';
import { SESSION_REPOSITORY, type SessionRepository } from './internal/application/port/out/session-repository';
import {
  VERIFICATION_STATUS_READER,
  VERIFICATION_STATUS_WRITER,
  type VerificationStatusReader,
  type VerificationStatusWriter,
} from './internal/application/port/out/verification-status-projector';
import { PASSWORD_HASHER, type PasswordHasher } from './internal/application/port/out/password-hasher';
import { TOKEN_SERVICE, CLOCK, type Clock, type TokenService } from './internal/application/port/out/token-service';
import { MODULE_NAME } from './internal/domain/module-status';
import {
  PUBLIC_PROFILE_READER,
  type PublicProfileReader,
} from './api/public-profile-reader';
import { SqlPublicProfileReader } from './internal/adapter/out/persistence/sql-public-profile-reader';
import { SqlNotificationManagement } from './internal/adapter/out/persistence/sql-notification-management';
import { NotificationsController } from './internal/adapter/in/web/notifications.controller';
import { NotificationDevicesController } from './internal/adapter/in/web/notification-devices.controller';
import { NOTIFICATION_MANAGEMENT, type NotificationManagementPort } from './internal/application/port/notification-management';
import { PushDeliveryWorker } from './internal/application/push-delivery-worker';
import { PUSH_DELIVERY_STORE, type PushDeliveryStorePort } from './internal/application/port/push-delivery-store';
import { PUSH_DELIVERY_LOGGER, type PushDeliveryLoggerPort } from './internal/application/port/push-delivery-logger';
import { PUSH_PROVIDER, type PushProviderPort } from './internal/application/port/push-provider';
import { SqlPushDeliveryStore } from './internal/adapter/out/persistence/sql-push-delivery-store';
import { ExpoPushProvider } from './internal/adapter/out/push/expo-push-provider';

/** Registers this module's DataSource pool and the FR-017 verification consumers. */
@Injectable()
export class AccountProfileRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly config: ApiConfig,
    private readonly handlers: EventHandlerRegistry,
    @Inject(VERIFICATION_STATUS_WRITER) private readonly projector: VerificationStatusWriter,
    @Inject(NOTIFICATION_MANAGEMENT) private readonly notificationManagement: NotificationManagementPort,
  ) {}

  onModuleInit(): void {
    this.registry.register(MODULE_NAME, SCHEMA, (schema) =>
      createModuleDataSource(this.config, schema),
    );
    const useCase = new ProjectVerificationStatusUseCase(this.projector);
    for (const eventType of [
      'student.verification.submitted',
      'student.verification.approved',
      'student.verification.rejected',
      'student.verification.revoked',
    ]) {
      this.handlers.register({
        moduleName: MODULE_NAME,
        eventType,
        queue: `account-profile.${eventType.replace(/\./g, '-')}`,
        handler: async (message: BusMessage): Promise<void> => {
          const event = studentVerificationEventSchema.parse(message.payload);
          await useCase.execute(event);
        },
      });
    }

    for (const eventType of ['student.verification.approved', 'student.verification.rejected', 'student.verification.revoked']) {
      this.handlers.register({
        moduleName: MODULE_NAME,
        eventType,
        queue: `account-profile.notification-${eventType.replace(/\./g, '-')}`,
        handler: async (message: BusMessage): Promise<void> => {
          const event = studentVerificationEventSchema.parse(message.payload);
          await this.notificationManagement.recordInboxNotification({
            eventId: message.id, accountId: event.accountId, type: 'verification_outcome', targetType: 'verification', targetId: event.verificationId,
          });
        },
      });
    }
    this.handlers.register({
      moduleName: MODULE_NAME, eventType: 'booking.confirmed', queue: 'account-profile.notification-booking-confirmed',
      handler: async (message: BusMessage): Promise<void> => {
        const event = bookingConfirmedSchema.parse(message.payload);
        if (!event.settled) return;
        for (const accountId of new Set([event.studentId, event.teacherId])) {
          await this.notificationManagement.recordInboxNotification({ eventId: message.id, accountId, type: 'booking_confirmed', targetType: 'booking', targetId: event.bookingId });
        }
      },
    });
    this.handlers.register({
      moduleName: MODULE_NAME, eventType: 'booking.cancelled', queue: 'account-profile.notification-booking-cancelled',
      handler: async (message: BusMessage): Promise<void> => {
        const event = bookingCancelledSchema.parse(message.payload);
        await this.notificationManagement.recordInboxNotification({ eventId: message.id, accountId: event.learnerId, type: 'booking_cancelled', targetType: 'booking', targetId: event.bookingId });
      },
    });
    this.handlers.register({
      moduleName: MODULE_NAME, eventType: 'wallet.transaction.completed', queue: 'account-profile.notification-wallet-completed',
      handler: async (message: BusMessage): Promise<void> => {
        const event = walletTransactionCompletedEventSchema.parse(message.payload);
        await this.notificationManagement.recordInboxNotification({ eventId: message.id, accountId: event.accountId, type: 'wallet_transaction', targetType: 'wallet', targetId: event.transactionId });
      },
    });
    this.handlers.register({
      // FR-016 (W3): one event carries every participant, so the fan-out happens here rather than
      // multiplying outbox rows by seats. `eventId` is the message id for every person, which is
      // what makes a redelivered event leave each inbox with one row instead of one per retry.
      moduleName: MODULE_NAME,
      eventType: CLASS_STARTING_SOON_EVENT,
      queue: 'account-profile.notification-class-starting-soon',
      handler: async (message: BusMessage): Promise<void> => {
        const event = classStartingSoonSchema.parse(message.payload);
        // A participant may legitimately appear twice (a repeat booking by the same learner); the
        // reminder is one per person, so the roles are collapsed rather than sent twice.
        for (const accountId of new Set(event.participants.map((p) => p.accountId))) {
          await this.notificationManagement.recordInboxNotification({
            eventId: message.id,
            accountId,
            type: 'class_starting_soon',
            targetType: 'class',
            targetId: event.classId,
          });
        }
      },
    });
  }
}

@Module({
  controllers: [
    AuthController,
    NotificationsController,
    NotificationDevicesController,
    // FR-015 / ADR-037: the account lock lives here because this module owns `accounts`.
    AccountLockController,
  ],
  providers: [
    {
      provide: ACCOUNT_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): AccountRepository =>
        new SqlAccountRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    // FR-015 / ADR-037: same adapter, separate capability — the dashboard may read the lock list
    // without being able to suspend anyone.
    {
      provide: ACCOUNT_LOCK_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): AccountLockRepository =>
        new SqlAccountRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: SUSPENDED_ACCOUNT_READER,
      useFactory: (
        registry: ModuleDataSourceRegistry,
        locks: AccountLockRepository,
      ): SuspendedAccountReader => new SqlSuspendedAccountReader(locks, MODULE_NAME),
      inject: [ModuleDataSourceRegistry, ACCOUNT_LOCK_REPOSITORY],
    },
    {
      // FR-015 / OQ-015 / ADR-037: the Administrator's suspend / reactivate action.
      provide: LOCK_ACCOUNT_PORT,
      useFactory: (locks: AccountLockRepository, clock: Clock): LockAccountPort =>
        new LockAccountUseCase(locks, clock),
      inject: [ACCOUNT_LOCK_REPOSITORY, CLOCK],
    },
    {
      provide: CREDENTIAL_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): CredentialRepository =>
        new SqlCredentialRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: SESSION_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): SessionRepository =>
        new SqlSessionRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: VERIFICATION_STATUS_READER,
      useFactory: (registry: ModuleDataSourceRegistry): VerificationStatusReader =>
        new SqlVerificationStatusProjector(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: VERIFICATION_STATUS_WRITER,
      useFactory: (registry: ModuleDataSourceRegistry): VerificationStatusWriter =>
        new SqlVerificationStatusProjector(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    { provide: PASSWORD_HASHER, useFactory: (): PasswordHasher => new ScryptPasswordHasher() },
    { provide: CLOCK, useFactory: (): Clock => new SystemClock() },
    {
      provide: TOKEN_SERVICE,
      useFactory: (config: ApiConfig, clock: Clock): TokenService =>
        new NodeTokenService(config.jwtPrivateKeyPath, config.accessTokenTtlSeconds, () => clock.now()),
      inject: [ApiConfig, CLOCK],
    },
    {
      provide: REGISTER_ACCOUNT,
      useFactory: (
        accounts: AccountRepository,
        credentials: CredentialRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
        sessions: SessionRepository,
        clock: Clock,
      ) =>
        new RegisterAccountUseCase(accounts, credentials, hasher, { tokens, sessions, clock }),
      inject: [ACCOUNT_REPOSITORY, CREDENTIAL_REPOSITORY, PASSWORD_HASHER, TOKEN_SERVICE, SESSION_REPOSITORY, CLOCK],
    },
    {
      provide: LOGIN,
      useFactory: (
        accounts: AccountRepository,
        credentials: CredentialRepository,
        hasher: PasswordHasher,
        tokens: TokenService,
        sessions: SessionRepository,
        clock: Clock,
      ) => new LoginUseCase(accounts, credentials, hasher, { tokens, sessions, clock }),
      inject: [ACCOUNT_REPOSITORY, CREDENTIAL_REPOSITORY, PASSWORD_HASHER, TOKEN_SERVICE, SESSION_REPOSITORY, CLOCK],
    },
    {
      provide: REFRESH_SESSION,
      useFactory: (
        accounts: AccountRepository,
        tokens: TokenService,
        sessions: SessionRepository,
        clock: Clock,
      ) => new RefreshSessionUseCase(accounts, sessions, tokens, clock, { tokens, sessions, clock }),
      inject: [ACCOUNT_REPOSITORY, TOKEN_SERVICE, SESSION_REPOSITORY, CLOCK],
    },
    {
      provide: LOGOUT,
      useFactory: (tokens: TokenService, sessions: SessionRepository) =>
        new LogoutUseCase(sessions, tokens),
      inject: [TOKEN_SERVICE, SESSION_REPOSITORY],
    },
    {
      provide: GET_ME,
      useFactory: (accounts: AccountRepository, verificationStatus: VerificationStatusReader) =>
        new GetMeUseCase(accounts, verificationStatus),
      inject: [ACCOUNT_REPOSITORY, VERIFICATION_STATUS_READER],
    },
    {
      provide: PUBLIC_PROFILE_READER,
      useFactory: (registry: ModuleDataSourceRegistry): PublicProfileReader =>
        new SqlPublicProfileReader(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: NOTIFICATION_MANAGEMENT,
      useFactory: (registry: ModuleDataSourceRegistry): NotificationManagementPort => new SqlNotificationManagement(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: PUSH_DELIVERY_STORE,
      useFactory: (registry: ModuleDataSourceRegistry): PushDeliveryStorePort => new SqlPushDeliveryStore(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    { provide: PUSH_PROVIDER, useFactory: (): PushProviderPort => new ExpoPushProvider() },
    {
      provide: PUSH_DELIVERY_LOGGER,
      useFactory: (logger: AppLogger): PushDeliveryLoggerPort => {
        const scoped = logger.child('account-profile.push-delivery');
        return { error: (error, message) => scoped.error(error, message) };
      },
      inject: [AppLogger],
    },
    {
      provide: PushDeliveryWorker,
      useFactory: (store: PushDeliveryStorePort, provider: PushProviderPort, logger: PushDeliveryLoggerPort) =>
        new PushDeliveryWorker(store, provider, logger),
      inject: [PUSH_DELIVERY_STORE, PUSH_PROVIDER, PUSH_DELIVERY_LOGGER],
    },
    AccountProfileRegistrar,
  ],
  exports: [PUBLIC_PROFILE_READER, SUSPENDED_ACCOUNT_READER, ACCOUNT_LOCK_REPOSITORY],
})
export class AccountProfileModule {}
