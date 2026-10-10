import { Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { studentVerificationEventSchema } from '@skillswap/contracts';
import { ApiConfig } from '../../shared/config/api-config';
import { EventHandlerRegistry, type BusMessage } from '../../shared/messaging/event-handler-registry';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlModuleStatusReader } from './internal/adapter/out/persistence/sql-module-status-reader';
import { SqlModuleStatusWriter } from './internal/adapter/out/persistence/sql-module-status-writer';
import { SqlAccountRepository } from './internal/adapter/out/persistence/sql-account-repository';
import { SqlCredentialRepository } from './internal/adapter/out/persistence/sql-credential-repository';
import { SqlSessionRepository } from './internal/adapter/out/persistence/sql-session-repository';
import { SqlVerificationStatusProjector } from './internal/adapter/out/persistence/sql-verification-status-projector';
import { ScryptPasswordHasher } from './internal/adapter/out/crypto/scrypt-password-hasher';
import { NodeTokenService } from './internal/adapter/out/crypto/node-token-service';
import { SystemClock } from './internal/adapter/out/crypto/system-clock';
import { StatusController } from './internal/adapter/in/web/status.controller';
import { AuthController } from './internal/adapter/in/web/auth.controller';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { RegisterAccountUseCase } from './internal/application/register-account.use-case';
import { LoginUseCase } from './internal/application/login.use-case';
import { RefreshSessionUseCase } from './internal/application/refresh-session.use-case';
import { LogoutUseCase } from './internal/application/logout.use-case';
import { GetMeUseCase } from './internal/application/get-me.use-case';
import { ProjectVerificationStatusUseCase } from './internal/application/project-verification-status.use-case';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import { REGISTER_ACCOUNT } from './internal/application/port/in/register-account';
import { LOGIN } from './internal/application/port/in/login';
import { REFRESH_SESSION } from './internal/application/port/in/refresh-session';
import { LOGOUT } from './internal/application/port/in/logout';
import { GET_ME } from './internal/application/port/in/get-me';
import { STATUS_READER, type ModuleStatusReader } from './internal/application/port/out/module-status-reader';
import { STATUS_WRITER, type ModuleStatusWriter } from './internal/application/port/out/module-status-writer';
import { ACCOUNT_REPOSITORY, type AccountRepository } from './internal/application/port/out/account-repository';
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
import { GetModuleStatusQueryHandler } from './internal/application/query/get-module-status.query';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers this module's DataSource pool and the FR-017 verification consumers. */
@Injectable()
export class AccountProfileRegistrar implements OnModuleInit {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly config: ApiConfig,
    private readonly handlers: EventHandlerRegistry,
    @Inject(VERIFICATION_STATUS_WRITER) private readonly projector: VerificationStatusWriter,
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
  }
}

@Module({
  controllers: [StatusController, AuthController],
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
      provide: ACCOUNT_REPOSITORY,
      useFactory: (registry: ModuleDataSourceRegistry): AccountRepository =>
        new SqlAccountRepository(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
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
    AccountProfileRegistrar,
  ],
})
export class AccountProfileModule {}
