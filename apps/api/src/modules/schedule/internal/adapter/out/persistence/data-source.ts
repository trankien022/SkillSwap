import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ApiConfig } from '../../../../../../shared/config/api-config';
import { MIGRATIONS_TABLE } from '../../../../../../shared/messaging/constants';
import { CreateModuleTables1791072000000 } from './migrations/1791072000000-CreateModuleTables';
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
