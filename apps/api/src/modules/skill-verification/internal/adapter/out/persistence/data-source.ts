import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ApiConfig } from '../../../../../../shared/config/api-config';
import { MIGRATIONS_TABLE } from '../../../../../../shared/messaging/constants';
import { CreateModuleTables1791072000000 } from './migrations/1791072000000-CreateModuleTables';
import { CreateSkillEvidence1791072000600 } from './migrations/1791072000600-CreateSkillEvidence';
import { CreateVerifiedStudentProjection1791072000601 } from './migrations/1791072000601-CreateVerifiedStudentProjection';
import { CreateVerifiersAndEvidenceClaim1791072000602 } from './migrations/1791072000602-CreateVerifiersAndEvidenceClaim';
import { CreateSkillEvidenceAudit1791072000603 } from './migrations/1791072000603-CreateSkillEvidenceAudit';
import { AddVerifierQueueIndex1791072000604 } from './migrations/1791072000604-AddVerifierQueueIndex';
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
      CreateSkillEvidence1791072000600,
      CreateVerifiedStudentProjection1791072000601,
      CreateVerifiersAndEvidenceClaim1791072000602,
      CreateSkillEvidenceAudit1791072000603,
      AddVerifierQueueIndex1791072000604,
    ],
    migrationsTableName: MIGRATIONS_TABLE,
    synchronize: false,
    logging: false,
    entities: [],
  });
}
