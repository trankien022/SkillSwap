import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ApiConfig } from '../../../../../../shared/config/api-config';
import { MIGRATIONS_TABLE } from '../../../../../../shared/messaging/constants';
import { CreateModuleTables1791072000000 } from './migrations/1791072000000-CreateModuleTables';
import { CreateStudentVerifications1791072000100 } from './migrations/1791072000100-CreateStudentVerifications';
import { DropVerificationExpiryAndSuperseded1791072000101 } from './migrations/1791072000101-DropVerificationExpiryAndSuperseded';
import { CreateVerificationDocuments1791072000102 } from './migrations/1791072000102-CreateVerificationDocuments';
import { AddVerificationRevocation1791072000103 } from './migrations/1791072000103-AddVerificationRevocation';
import { AddAdminVerificationQueueIndex1791072000104 } from './migrations/1791072000104-AddAdminVerificationQueueIndex';
import { AddOutboxRetryBackoff1791072000500 } from './migrations/1791072000500-AddOutboxRetryBackoff';
import { AddOutboxSequence1791072000600 } from './migrations/1791072000600-AddOutboxSequence';
import { AddProcessedEventSequence1791072000601 } from './migrations/1791072000601-AddProcessedEventSequence';
import { SCHEMA } from './schema';

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
      CreateStudentVerifications1791072000100,
      DropVerificationExpiryAndSuperseded1791072000101,
      CreateVerificationDocuments1791072000102,
      AddVerificationRevocation1791072000103,
      AddAdminVerificationQueueIndex1791072000104,
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
