import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ApiConfig } from '../../../../../../shared/config/api-config';
import { MIGRATIONS_TABLE } from '../../../../../../shared/messaging/constants';
import { CreateModuleTables1791072000000 } from './migrations/1791072000000-CreateModuleTables';
import { CreateAdminAuditEvent1791072000001 } from './migrations/1791072000001-CreateAdminAuditEvent';
import { AddOutboxRetryBackoff1791072000500 } from './migrations/1791072000500-AddOutboxRetryBackoff';
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
      CreateAdminAuditEvent1791072000001,
      // ADR-013 Amendment A (W2 C2): shared outbox backoff, one migration per schema.
      AddOutboxRetryBackoff1791072000500,
    ],
    migrationsTableName: MIGRATIONS_TABLE,
    synchronize: false,
    logging: false,
    entities: [],
  });
}
