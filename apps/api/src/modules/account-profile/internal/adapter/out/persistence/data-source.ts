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
    ],
    migrationsTableName: MIGRATIONS_TABLE,
    synchronize: false,
    logging: false,
    entities: [],
  });
}
