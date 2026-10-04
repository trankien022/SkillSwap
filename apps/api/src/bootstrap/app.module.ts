import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ApiConfig } from '../shared/config/api-config';
import { AppLogger } from '../shared/logger/app-logger';
import { DomainErrorFilter } from '../shared/http/domain-error.filter';
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
    {
      provide: APP_GUARD,
      useFactory: (config: ApiConfig) => new TrustedIdentityGuard(config.authMode),
      inject: [ApiConfig],
    },
    {
      provide: APP_FILTER,
      useFactory: (logger: AppLogger) => new DomainErrorFilter(logger.child('http')),
      inject: [AppLogger],
    },
  ],
})
export class AppModule {}
