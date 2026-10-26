import { AddNotificationDeviceLocale1791072000008 } from './migrations/1791072000008-AddNotificationDeviceLocale';
import { AddAccountSuspension1791072000009 } from './migrations/1791072000009-AddAccountSuspension';
import { RequireSuspendedAt1791072000010 } from './migrations/1791072000010-RequireSuspendedAt';
import { AddOutboxRetryBackoff1791072000500 } from './migrations/1791072000500-AddOutboxRetryBackoff';
import { AddOutboxSequence1791072000600 } from './migrations/1791072000600-AddOutboxSequence';
import { AddProcessedEventSequence1791072000601 } from './migrations/1791072000601-AddProcessedEventSequence';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ApiConfig } from '../../../../../../shared/config/api-config';
import { MIGRATIONS_TABLE } from '../../../../../../shared/messaging/constants';
import { CreateModuleTables1791072000000 } from './migrations/1791072000000-CreateModuleTables';
import { CreateAccountTables1791072000001 } from './migrations/1791072000001-CreateAccountTables';
import { CreateAccountVerificationStatus1791072000002 } from './migrations/1791072000002-CreateAccountVerificationStatus';
import { WidenAccountVerificationStatus1791072000003 } from './migrations/1791072000003-WidenAccountVerificationStatus';
import { WidenAccountRoles1791072000004 } from './migrations/1791072000004-WidenAccountRoles';
import { CollapseAccountRoles1791072000005 } from './migrations/1791072000005-CollapseAccountRoles';
import { SCHEMA } from './schema';
import { CreateNotificationStorage1791072000006 } from './migrations/1791072000006-CreateNotificationStorage';
import { AddPushDeliveryLeasesAndReceipts1791072000007 } from './migrations/1791072000007-AddPushDeliveryLeasesAndReceipts';

/** One connection pool per module schema (ARCHITECTURE.md §5). */
export function createModuleDataSource(config: ApiConfig, schema: string = SCHEMA): DataSource {
  const credentials = config.databaseCredentials(schema);
  return new DataSource({
    type: 'postgres',
    host: config.databaseHost,
    port: config.databasePort,
    database: config.databaseName,
    username: credentials.user,
    password: credentials.password,
    schema,
    extra: { options: `-c search_path=${schema},public` },
    migrations: [
      CreateModuleTables1791072000000,
      CreateAccountTables1791072000001,
      CreateAccountVerificationStatus1791072000002,
      WidenAccountVerificationStatus1791072000003,
      WidenAccountRoles1791072000004,
      CollapseAccountRoles1791072000005,
      CreateNotificationStorage1791072000006,
      AddPushDeliveryLeasesAndReceipts1791072000007,
      AddNotificationDeviceLocale1791072000008,
      // FR-015 / OQ-015 / ADR-037: the admin-initiated account lock.
      AddAccountSuspension1791072000009,
      RequireSuspendedAt1791072000010,
      // ADR-013 Amendment A (W2 C2): shared outbox backoff, one migration per schema.
      AddOutboxRetryBackoff1791072000500,
      // ADR-013 Amendment A (W2 C1): per-aggregate sequence numbers, emitter half then
      // consumer half, one pair of migrations per schema.
      AddOutboxSequence1791072000600,
      AddProcessedEventSequence1791072000601,
    ],
    migrationsTableName: MIGRATIONS_TABLE,
    synchronize: false,
    logging: false,
    entities: [],
  });
}
