import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiConfig } from '../shared/config/api-config';
import { AppLogger } from '../shared/logger/app-logger';
import { DomainErrorFilter } from '../shared/http/domain-error.filter';
import { RolesGuard } from '../shared/http/roles.guard';
import { TrustedIdentityGuard } from '../shared/http/trusted-identity.guard';
import { SharedModule } from '../shared/shared.module';
import { AdminOperationModule } from '../modules/admin-operation/admin-operation.module';
import { StudentVerificationModule } from '../modules/student-verification/student-verification.module';
import { SkillVerificationModule } from '../modules/skill-verification/skill-verification.module';
import { AccountProfileModule } from '../modules/account-profile/account-profile.module';
import { LiveClassModule } from '../modules/live-class/live-class.module';
import { WalletLedgerModule } from '../modules/wallet-ledger/wallet-ledger.module';
import { ScheduleModule } from '../modules/schedule/schedule.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    SharedModule,
    AdminOperationModule,
    StudentVerificationModule,
    SkillVerificationModule,
    AccountProfileModule,
    LiveClassModule,
    WalletLedgerModule,
    ScheduleModule,
  ],
  controllers: [HealthController],
  providers: [
    // nestjs-zod: validate every @Body/@Query against the DTO's zod schema and
    // surface those schemas to Swagger. Controllers no longer pass a per-body pipe.
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_GUARD,
      useFactory: (config: ApiConfig) => new TrustedIdentityGuard(config.authMode),
      inject: [ApiConfig],
    },
    // FR-001/FR-002/FR-004: opt-in role enforcement; a no-op on routes without @Roles.
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useFactory: (logger: AppLogger) => new DomainErrorFilter(logger.child('http')),
      inject: [AppLogger],
    },
  ],
})
export class AppModule {}
