import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ApiConfig } from '../../../../../../shared/config/api-config';
import { MIGRATIONS_TABLE } from '../../../../../../shared/messaging/constants';
import { CreateModuleTables1791072000000 } from './migrations/1791072000000-CreateModuleTables';
import { CreateStudentVerifications1791072000100 } from './migrations/1791072000100-CreateStudentVerifications';
import { DropVerificationExpiryAndSuperseded1791072000101 } from './migrations/1791072000101-DropVerificationExpiryAndSuperseded';
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
    ],
    migrationsTableName: MIGRATIONS_TABLE,
    synchronize: false,
    logging: false,
    entities: [],
  });
}
