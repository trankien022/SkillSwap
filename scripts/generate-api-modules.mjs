#!/usr/bin/env node
/**
 * Generates the seven modular-monolith module trees under apps/api/src/modules
 * (ARCHITECTURE.md §5 layout; D1: this script owns the module templates —
 * never hand-edit generated module sources, change templates here instead).
 *
 * Usage: node scripts/generate-api-modules.mjs [--force]
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulesRoot = join(root, 'apps', 'api', 'src', 'modules');
const force = process.argv.includes('--force');

const MIGRATION_CLASS = 'CreateModuleTables1791072000000';
const MIGRATION_FILE = '1791072000000-CreateModuleTables';

/**
 * @typedef {object} ModuleSpec
 * @property {string} folder  kebab-case package folder and physical schema id
 * @property {string} pascal  PascalCase class prefix
 * @property {string} label   human label for swagger/docs
 * @property {string} schema  PostgreSQL schema name (snake_case)
 * @property {string[]} states
 * @property {string} initial
 * @property {Record<string, string[]>} transitions
 * @property {boolean} [extras] wallet-only ledger tables + booking consumer
 */

/** @type {readonly ModuleSpec[]} */
const MODULES = [
  {
    folder: 'admin-operation',
    pascal: 'AdminOperation',
    label: 'Admin operation',
    schema: 'admin_operation',
    states: ['open', 'reviewing', 'resolved', 'dismissed'],
    initial: 'open',
    transitions: {
      open: ['reviewing', 'resolved'],
      reviewing: ['resolved', 'dismissed', 'open'],
      resolved: ['open'],
      dismissed: ['open'],
    },
  },
  {
    folder: 'student-verification',
    pascal: 'StudentVerification',
    label: 'Student verification',
    schema: 'student_verification',
    states: ['pending', 'reviewing', 'approved', 'rejected'],
    initial: 'pending',
    transitions: {
      pending: ['reviewing'],
      reviewing: ['approved', 'rejected', 'pending'],
      approved: ['pending'],
      rejected: ['pending'],
    },
  },
  {
    folder: 'skill-verification',
    pascal: 'SkillVerification',
    label: 'Skill verification',
    schema: 'skill_verification',
    states: ['draft', 'submitted', 'assessing', 'verified', 'rejected'],
    initial: 'draft',
    transitions: {
      draft: ['submitted'],
      submitted: ['assessing'],
      assessing: ['verified', 'rejected', 'submitted'],
      verified: ['assessing'],
      rejected: ['draft'],
    },
  },
  {
    folder: 'account-profile',
    pascal: 'AccountProfile',
    label: 'Account profile',
    schema: 'account_profile',
    states: ['incomplete', 'active', 'suspended'],
    initial: 'incomplete',
    transitions: {
      incomplete: ['active'],
      active: ['suspended', 'incomplete'],
      suspended: ['active'],
    },
  },
  {
    folder: 'live-class',
    pascal: 'LiveClass',
    label: 'Live class',
    schema: 'live_class',
    states: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    initial: 'scheduled',
    transitions: {
      scheduled: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
      cancelled: ['scheduled'],
    },
  },
  {
    folder: 'wallet-ledger',
    pascal: 'WalletLedger',
    label: 'Wallet ledger',
    schema: 'wallet_ledger',
    states: ['active', 'frozen', 'closed'],
    initial: 'active',
    transitions: {
      active: ['frozen', 'closed'],
      frozen: ['active', 'closed'],
      closed: ['active'],
    },
    extras: true,
  },
  {
    folder: 'schedule',
    pascal: 'Schedule',
    label: 'Schedule',
    schema: 'schedule',
    states: ['open', 'reserved', 'released'],
    initial: 'open',
    transitions: {
      open: ['reserved', 'released'],
      reserved: ['open'],
      released: ['open'],
    },
  },
];

const written = [];
const skipped = [];

function emit(folder, rel, content) {
  const target = join(modulesRoot, folder, rel);
  if (existsSync(target) && !force) {
    skipped.push(`${folder}/${rel}`);
    return;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
  written.push(`${folder}/${rel}`);
}

function illegalFromInitial(m) {
  const to = m.states.find((state) => !m.transitions[m.initial].includes(state));
  if (to === undefined) {
    throw new Error(`${m.folder}: transition table from "${m.initial}" is total — need an illegal pair`);
  }
  return to;
}

function domainTemplate(m) {
  const states = m.states.map((state) => `'${state}'`).join(', ');
  const transitions = m.states
    .map((state) => {
      const targets = m.transitions[state] ?? [];
      return `  ${state}: [${targets.map((t) => `'${t}'`).join(', ')}],`;
    })
    .join('\n');
  return `/** State machine for the ${m.label} module (ADR-010: state codes only). */

export const MODULE_NAME = '${m.folder}';

export const STATUS_CHANGED_EVENT = '${m.folder}.status.changed';

export const MODULE_STATUS_STATES = [${states}] as const;

export type ModuleStatusState = (typeof MODULE_STATUS_STATES)[number];

export const INITIAL_MODULE_STATUS: ModuleStatusState = '${m.initial}';

export const MODULE_STATUS_TRANSITIONS: Readonly<Record<ModuleStatusState, readonly ModuleStatusState[]>> = {
${transitions}
};

export class UnknownStateError extends Error {
  constructor(state: string) {
    super(\`Unknown module status state: \${state}\`);
    this.name = 'UnknownStateError';
  }
}

export class StatusTransitionError extends Error {
  constructor(from: ModuleStatusState, to: ModuleStatusState) {
    super(\`Illegal module status transition: \${from} -> \${to}\`);
    this.name = 'StatusTransitionError';
  }
}

export class StatusConflictError extends Error {
  constructor(expectedState: string, attemptedState: string) {
    super(\`Status conflict: expected \${expectedState} while applying \${attemptedState}\`);
    this.name = 'StatusConflictError';
  }
}

export function isModuleStatusState(value: string): value is ModuleStatusState {
  return (MODULE_STATUS_STATES as readonly string[]).includes(value);
}

export function assertModuleStatusState(value: string): asserts value is ModuleStatusState {
  if (!isModuleStatusState(value)) {
    throw new UnknownStateError(value);
  }
}

export function canTransition(from: ModuleStatusState, to: ModuleStatusState): boolean {
  return MODULE_STATUS_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ModuleStatusState, to: ModuleStatusState): void {
  if (!canTransition(from, to)) {
    throw new StatusTransitionError(from, to);
  }
}
`;
}

function domainSpecTemplate(m) {
  return `import {
  INITIAL_MODULE_STATUS,
  MODULE_NAME,
  MODULE_STATUS_STATES,
  MODULE_STATUS_TRANSITIONS,
  STATUS_CHANGED_EVENT,
  StatusTransitionError,
  UnknownStateError,
  assertModuleStatusState,
  assertTransition,
  canTransition,
  isModuleStatusState,
  type ModuleStatusState,
} from './module-status';

describe('${m.folder} module status state machine', () => {
  it('declares an allowed initial state and stable names', () => {
    expect(MODULE_NAME).toBe('${m.folder}');
    expect(STATUS_CHANGED_EVENT).toBe('${m.folder}.status.changed');
    expect(MODULE_STATUS_STATES).toContain(INITIAL_MODULE_STATUS);
  });

  it('accepts every declared transition', () => {
    for (const [from, targets] of Object.entries(MODULE_STATUS_TRANSITIONS)) {
      for (const to of targets) {
        expect(canTransition(from as ModuleStatusState, to)).toBe(true);
        expect(() => assertTransition(from as ModuleStatusState, to)).not.toThrow();
      }
    }
  });

  it('rejects every undeclared transition', () => {
    for (const from of MODULE_STATUS_STATES) {
      for (const to of MODULE_STATUS_STATES) {
        if (MODULE_STATUS_TRANSITIONS[from].includes(to)) continue;
        expect(canTransition(from, to)).toBe(false);
        expect(() => assertTransition(from, to)).toThrow(StatusTransitionError);
      }
    }
  });

  it('rejects unknown states', () => {
    expect(isModuleStatusState('bogus')).toBe(false);
    expect(() => assertModuleStatusState('bogus')).toThrow(UnknownStateError);
    expect(() => assertModuleStatusState(INITIAL_MODULE_STATUS)).not.toThrow();
  });
});
`;
}

function advancePortTemplate() {
  return `export const ADVANCE_STATUS = Symbol('ADVANCE_STATUS');

export interface AdvanceStatusCommand {
  toState: string;
  changedBy: string;
}

export interface AdvanceStatusResult {
  module: string;
  previousState: string;
  newState: string;
  changedAt: string;
  changedBy: string;
}

export interface AdvanceStatusPort {
  execute(command: AdvanceStatusCommand): Promise<AdvanceStatusResult>;
}
`;
}

function getPortTemplate() {
  return `import type { ModuleStatusView } from '../out/module-status-reader';

export const GET_MODULE_STATUS = Symbol('GET_MODULE_STATUS');

export interface GetModuleStatusPort {
  execute(): Promise<ModuleStatusView>;
}
`;
}

function readerPortTemplate() {
  return `export const STATUS_READER = Symbol('STATUS_READER');

export interface ModuleStatusView {
  module: string;
  state: string;
  updatedAt: string | null;
}

export interface ModuleStatusReader {
  find(): Promise<ModuleStatusView>;
}
`;
}

function writerPortTemplate() {
  return `import type { ModuleStatusState } from '../../../domain/module-status';

export const STATUS_WRITER = Symbol('STATUS_WRITER');

export interface ModuleStatusWriteInput {
  previousState: ModuleStatusState;
  newState: ModuleStatusState;
  changedBy: string;
}

export interface ModuleStatusTransition {
  module: string;
  previousState: string;
  newState: string;
  changedAt: string;
  changedBy: string;
}

export interface ModuleStatusWriter {
  apply(input: ModuleStatusWriteInput): Promise<ModuleStatusTransition>;
}
`;
}

function useCaseTemplate(m, firstTarget) {
  return `import { assertModuleStatusState, assertTransition } from '../domain/module-status';
import type {
  AdvanceStatusCommand,
  AdvanceStatusPort,
  AdvanceStatusResult,
} from './port/in/advance-status';
import type { ModuleStatusReader } from './port/out/module-status-reader';
import type { ModuleStatusWriter } from './port/out/module-status-writer';

/** Validates and applies a status transition for the ${m.label} module (ADR-010). */
export class AdvanceStatusUseCase implements AdvanceStatusPort {
  constructor(
    private readonly reader: ModuleStatusReader,
    private readonly writer: ModuleStatusWriter,
  ) {}

  async execute(command: AdvanceStatusCommand): Promise<AdvanceStatusResult> {
    const current = await this.reader.find();
    assertModuleStatusState(current.state);
    assertModuleStatusState(command.toState);
    assertTransition(current.state, command.toState);
    return this.writer.apply({
      previousState: current.state,
      newState: command.toState,
      changedBy: command.changedBy,
    });
  }
}
`.replace('${firstTarget}', firstTarget);
}

function useCaseSpecTemplate(m, firstTarget, illegalTo) {
  return `import { AdvanceStatusUseCase } from './advance-status.use-case';
import type { ModuleStatusReader } from './port/out/module-status-reader';
import type { ModuleStatusWriter } from './port/out/module-status-writer';
import {
  StatusConflictError,
  StatusTransitionError,
  UnknownStateError,
  type ModuleStatusState,
} from '../domain/module-status';

describe('AdvanceStatusUseCase (${m.folder})', () => {
  function setup(initialState: ModuleStatusState) {
    const reader: ModuleStatusReader = {
      find: jest.fn().mockResolvedValue({ module: '${m.folder}', state: initialState, updatedAt: null }),
    };
    const apply = jest.fn().mockResolvedValue({
      module: '${m.folder}',
      previousState: initialState,
      newState: '${firstTarget}',
      changedAt: '2026-01-01T00:00:00.000Z',
      changedBy: 'user-1',
    });
    const writer: ModuleStatusWriter = { apply };
    return { useCase: new AdvanceStatusUseCase(reader, writer), apply };
  }

  it('advances along a legal transition', async () => {
    const { useCase, apply } = setup('${m.initial}');
    const result = await useCase.execute({ toState: '${firstTarget}', changedBy: 'user-1' });
    expect(apply).toHaveBeenCalledWith({
      previousState: '${m.initial}',
      newState: '${firstTarget}',
      changedBy: 'user-1',
    });
    expect(result.newState).toBe('${firstTarget}');
  });

  it('rejects an illegal transition without writing', async () => {
    const { useCase, apply } = setup('${m.initial}');
    await expect(useCase.execute({ toState: '${illegalTo}', changedBy: 'user-1' })).rejects.toThrow(
      StatusTransitionError,
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('rejects an unknown state without writing', async () => {
    const { useCase, apply } = setup('${m.initial}');
    await expect(useCase.execute({ toState: 'bogus', changedBy: 'user-1' })).rejects.toThrow(
      UnknownStateError,
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it('propagates optimistic-lock conflicts from the writer', async () => {
    const { useCase, apply } = setup('${m.initial}');
    apply.mockRejectedValue(new StatusConflictError('${m.initial}', '${firstTarget}'));
    await expect(useCase.execute({ toState: '${firstTarget}', changedBy: 'user-1' })).rejects.toThrow(
      StatusConflictError,
    );
  });
});
`;
}

function queryTemplate() {
  return `import type { GetModuleStatusPort } from '../port/in/get-module-status';
import type { ModuleStatusReader, ModuleStatusView } from '../port/out/module-status-reader';

/** Query handler (ADR-012: the read path never imports the domain). */
export class GetModuleStatusQueryHandler implements GetModuleStatusPort {
  constructor(private readonly reader: ModuleStatusReader) {}

  execute(): Promise<ModuleStatusView> {
    return this.reader.find();
  }
}
`;
}

function controllerTemplate(m) {
  return `import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { advanceStatusSchema } from '@skillswap/contracts';
import {
  ADVANCE_STATUS,
  type AdvanceStatusPort,
  type AdvanceStatusResult,
} from '../../../application/port/in/advance-status';
import {
  GET_MODULE_STATUS,
  type GetModuleStatusPort,
} from '../../../application/port/in/get-module-status';
import type { ModuleStatusView } from '../../../application/port/out/module-status-reader';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

@Controller('${m.folder}')
@ApiTags('${m.folder}')
export class StatusController {
  constructor(
    @Inject(ADVANCE_STATUS) private readonly advanceStatus: AdvanceStatusPort,
    @Inject(GET_MODULE_STATUS) private readonly getStatus: GetModuleStatusPort,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Read ${m.label} module status' })
  @ApiOkResponse({ description: 'Current module status' })
  readStatus(): Promise<ModuleStatusView> {
    return this.getStatus.execute();
  }

  @Post('status/advance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance ${m.label} module status' })
  @ApiOkResponse({ description: 'Applied status transition' })
  advance(
    @Body(new ZodValidationPipe(advanceStatusSchema)) body: { toState: string },
    @Req() request: RequestWithIdentity,
  ): Promise<AdvanceStatusResult> {
    return this.advanceStatus.execute({
      toState: body.toState,
      changedBy: currentUserId(request),
    });
  }
}
`;
}

function schemaTemplate(m) {
  return `/** Physical schema (PostgreSQL namespace) of the ${m.label} module. */
export const SCHEMA = '${m.schema}';
`;
}

function dataSourceTemplate() {
  return `import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ApiConfig } from '../../../../../../shared/config/api-config';
import { MIGRATIONS_TABLE } from '../../../../../../shared/messaging/constants';
import { CreateModuleTables1791072000000 } from './migrations/1791072000000-CreateModuleTables';
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
    extra: { options: \`-c search_path=\${schema},public\` },
    migrations: [CreateModuleTables1791072000000],
    migrationsTableName: MIGRATIONS_TABLE,
    synchronize: false,
    logging: false,
    entities: [],
  });
}
`;
}

function migrationTemplate(m) {
  const tables = ['module_status', 'outbox_messages', 'processed_events'];
  if (m.extras) {
    tables.push('ledger_entries');
  }
  const tableList = tables.map((name) => `'${name}'`).join(', ');
  const ledgerSql = m.extras
    ? `
    await queryRunner.query(\`CREATE TABLE IF NOT EXISTS \${table('ledger_entries')} (
      "id" bigserial PRIMARY KEY,
      "booking_id" text NOT NULL UNIQUE,
      "teacher_id" text NOT NULL,
      "amount_credits" integer NOT NULL CHECK ("amount_credits" > 0),
      "direction" text NOT NULL CHECK ("direction" IN ('credit', 'debit')),
      "created_at" timestamptz NOT NULL DEFAULT now()
    )\`);`
    : '';
  return `import type { MigrationInterface, QueryRunner } from 'typeorm';
import { SCHEMA } from '../schema';

const TABLES = [${tableList}];

function table(name: string): string {
  return \`"\${SCHEMA}"."\${name}"\`;
}

/** Creates the ${m.label} module tables (one schema per module, ARCHITECTURE.md §5). */
export class ${MIGRATION_CLASS} implements MigrationInterface {
  name = '${MIGRATION_CLASS}';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(\`CREATE TABLE IF NOT EXISTS \${table('module_status')} (
      "id" integer PRIMARY KEY CHECK ("id" = 1),
      "state" text NOT NULL,
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )\`);
    await queryRunner.query(
      \`INSERT INTO \${table('module_status')} ("id", "state") ` +
        `VALUES (1, '${m.initial}') ON CONFLICT ("id") DO NOTHING\`,
    );
    await queryRunner.query(\`CREATE TABLE IF NOT EXISTS \${table('outbox_messages')} (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "event_type" text NOT NULL,
      "payload" jsonb NOT NULL,
      "status" text NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'PUBLISHED', 'DEAD')),
      "attempts" integer NOT NULL DEFAULT 0,
      "last_error" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "published_at" timestamptz
    )\`);
    await queryRunner.query(
      \`CREATE INDEX IF NOT EXISTS "ix_outbox_messages_status_created" ` +
        `ON \${table('outbox_messages')} ("status", "created_at")\`,
    );
    await queryRunner.query(\`CREATE TABLE IF NOT EXISTS \${table('processed_events')} (
      "id" text PRIMARY KEY,
      "status" text NOT NULL DEFAULT 'PROCESSING' CHECK ("status" IN ('PROCESSING', 'DONE', 'FAILED')),
      "error" text,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "processed_at" timestamptz
    )\`);
${ledgerSql}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of [...TABLES].reverse()) {
      await queryRunner.query(\`DROP TABLE IF EXISTS \${table(name)}\`);
    }
  }
}
`;
}

function sqlReaderTemplate() {
  return `import { ModuleNotInitialisedError } from '../../../../../../shared/errors';
import { MODULE_STATUS_ID, MODULE_STATUS_TABLE } from '../../../../../../shared/messaging/constants';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  ModuleStatusReader,
  ModuleStatusView,
} from '../../../application/port/out/module-status-reader';

export class SqlModuleStatusReader implements ModuleStatusReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  async find(): Promise<ModuleStatusView> {
    const source = this.registry.get(this.moduleName);
    const table = qualified(this.registry.getSchema(this.moduleName), MODULE_STATUS_TABLE);
    const rows = (await source.query(
      \`SELECT "state", "updated_at" FROM \${table} WHERE "id" = $1\`,
      [MODULE_STATUS_ID],
    )) as Array<{ state: string; updated_at: Date | string | null }>;
    const row = rows[0];
    if (row === undefined) {
      throw new ModuleNotInitialisedError(this.moduleName);
    }
    const updatedAt = row.updated_at;
    return {
      module: this.moduleName,
      state: row.state,
      updatedAt:
        updatedAt === null || updatedAt === undefined
          ? null
          : updatedAt instanceof Date
            ? updatedAt.toISOString()
            : new Date(updatedAt).toISOString(),
    };
  }
}
`;
}

function sqlWriterTemplate() {
  return `import { MODULE_STATUS_ID, MODULE_STATUS_TABLE } from '../../../../../../shared/messaging/constants';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  ModuleStatusTransition,
  ModuleStatusWriteInput,
  ModuleStatusWriter,
} from '../../../application/port/out/module-status-writer';
import { STATUS_CHANGED_EVENT, StatusConflictError } from '../../../domain/module-status';

export class SqlModuleStatusWriter implements ModuleStatusWriter {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  async apply(input: ModuleStatusWriteInput): Promise<ModuleStatusTransition> {
    const source = this.registry.get(this.moduleName);
    const schema = this.registry.getSchema(this.moduleName);
    const table = qualified(schema, MODULE_STATUS_TABLE);
    return source.transaction(async (manager) => {
      const updated = (await manager.query(
        \`UPDATE \${table} SET "state" = $1, "updated_at" = now() ` +
          `WHERE "id" = $2 AND "state" = $3 RETURNING "updated_at"\`,
        [input.newState, MODULE_STATUS_ID, input.previousState],
      )) as Array<{ updated_at: Date | string }>;
      const row = updated[0];
      if (row === undefined) {
        throw new StatusConflictError(input.previousState, input.newState);
      }
      const changedAt =
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : new Date(row.updated_at).toISOString();
      const transition: ModuleStatusTransition = {
        module: this.moduleName,
        previousState: input.previousState,
        newState: input.newState,
        changedAt,
        changedBy: input.changedBy,
      };
      await manager.query(insertOutboxStatement(schema), [STATUS_CHANGED_EVENT, transition]);
      return transition;
    });
  }
}
`;
}

function moduleTemplate(m) {
  if (m.extras) {
    return walletModuleTemplate(m);
  }
  return `import { Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { ApiConfig } from '../../shared/config/api-config';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlModuleStatusReader } from './internal/adapter/out/persistence/sql-module-status-reader';
import { SqlModuleStatusWriter } from './internal/adapter/out/persistence/sql-module-status-writer';
import { StatusController } from './internal/adapter/in/web/status.controller';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import { STATUS_READER, type ModuleStatusReader } from './internal/application/port/out/module-status-reader';
import { STATUS_WRITER, type ModuleStatusWriter } from './internal/application/port/out/module-status-writer';
import { GetModuleStatusQueryHandler } from './internal/application/query/get-module-status.query';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers this module's DataSource pool on the shared registry (ARCHITECTURE.md §5). */
@Injectable()
export class ${m.pascal}Registrar implements OnModuleInit {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly config: ApiConfig,
  ) {}

  onModuleInit(): void {
    this.registry.register(MODULE_NAME, SCHEMA, (schema) =>
      createModuleDataSource(this.config, schema),
    );
  }
}

@Module({
  controllers: [StatusController],
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
    ${m.pascal}Registrar,
  ],
})
export class ${m.pascal}Module {}
`;
}

function walletModuleTemplate(m) {
  return `import { Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { bookingConfirmedSchema } from '@skillswap/contracts';
import { ApiConfig } from '../../shared/config/api-config';
import { EventHandlerRegistry, type BusMessage } from '../../shared/messaging/event-handler-registry';
import { ModuleDataSourceRegistry } from '../../shared/messaging/module-registry';
import { createModuleDataSource } from './internal/adapter/out/persistence/data-source';
import { SCHEMA } from './internal/adapter/out/persistence/schema';
import { SqlLedgerEntryWriter } from './internal/adapter/out/persistence/sql-ledger-entry-writer';
import { SqlModuleStatusReader } from './internal/adapter/out/persistence/sql-module-status-reader';
import { SqlModuleStatusWriter } from './internal/adapter/out/persistence/sql-module-status-writer';
import { StatusController } from './internal/adapter/in/web/status.controller';
import { AdvanceStatusUseCase } from './internal/application/advance-status.use-case';
import { RecordBookingConfirmedUseCase } from './internal/application/record-booking-confirmed.use-case';
import { GET_MODULE_STATUS } from './internal/application/port/in/get-module-status';
import { ADVANCE_STATUS } from './internal/application/port/in/advance-status';
import {
  RECORD_BOOKING_CONFIRMED,
  type RecordBookingConfirmedPort,
} from './internal/application/port/in/record-booking-confirmed';
import {
  LEDGER_ENTRY_WRITER,
  type LedgerEntryWriter,
} from './internal/application/port/out/ledger-entry-writer';
import { STATUS_READER, type ModuleStatusReader } from './internal/application/port/out/module-status-reader';
import { STATUS_WRITER, type ModuleStatusWriter } from './internal/application/port/out/module-status-writer';
import { GetModuleStatusQueryHandler } from './internal/application/query/get-module-status.query';
import { MODULE_NAME } from './internal/domain/module-status';

/** Registers the wallet DataSource pool and the booking.confirmed consumer. */
@Injectable()
export class ${m.pascal}Registrar implements OnModuleInit {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly config: ApiConfig,
    private readonly handlers: EventHandlerRegistry,
    @Inject(RECORD_BOOKING_CONFIRMED) private readonly recordBooking: RecordBookingConfirmedPort,
  ) {}

  onModuleInit(): void {
    this.registry.register(MODULE_NAME, SCHEMA, (schema) =>
      createModuleDataSource(this.config, schema),
    );
    this.handlers.register({
      moduleName: MODULE_NAME,
      eventType: 'booking.confirmed',
      queue: 'wallet-ledger.booking-confirmed',
      handler: async (message: BusMessage): Promise<void> => {
        const event = bookingConfirmedSchema.parse(message.payload);
        await this.recordBooking.execute(event);
      },
    });
  }
}

@Module({
  controllers: [StatusController],
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
      provide: LEDGER_ENTRY_WRITER,
      useFactory: (registry: ModuleDataSourceRegistry) =>
        new SqlLedgerEntryWriter(registry, MODULE_NAME),
      inject: [ModuleDataSourceRegistry],
    },
    {
      provide: RECORD_BOOKING_CONFIRMED,
      useFactory: (ledger: LedgerEntryWriter) => new RecordBookingConfirmedUseCase(ledger),
      inject: [LEDGER_ENTRY_WRITER],
    },
    ${m.pascal}Registrar,
  ],
})
export class ${m.pascal}Module {}
`;
}

function apiIndexTemplate(m) {
  return `export * from '../${m.folder}.module';
`;
}

function walletDomainTemplate() {
  return `import type { ModuleStatusState } from './module-status';

export const DEFAULT_FEE_BPS = 1000;

export interface FeeSplit {
  platformFeeCredits: number;
  teacherCredits: number;
}

/** Integer credit math — 1 credit = 1,000 VND, no rounding drift (§4 money rule). */
export function applyPlatformFee(amountCredits: number, feeBps: number = DEFAULT_FEE_BPS): FeeSplit {
  if (!Number.isInteger(amountCredits) || amountCredits <= 0) {
    throw new RangeError(\`amountCredits must be a positive integer, got \${amountCredits}\`);
  }
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new RangeError(\`feeBps must be an integer within [0, 10000], got \${feeBps}\`);
  }
  const platformFeeCredits = Math.floor((amountCredits * feeBps) / 10_000);
  return { platformFeeCredits, teacherCredits: amountCredits - platformFeeCredits };
}

export function canWithdraw(state: ModuleStatusState): boolean {
  return state === 'active';
}
`;
}

function walletDomainSpecTemplate() {
  return `import { DEFAULT_FEE_BPS, applyPlatformFee, canWithdraw } from './wallet';

describe('wallet credit math', () => {
  it('splits the default 10% platform fee with no rounding drift', () => {
    expect(DEFAULT_FEE_BPS).toBe(1000);
    expect(applyPlatformFee(1000)).toEqual({ platformFeeCredits: 100, teacherCredits: 900 });
    expect(applyPlatformFee(999)).toEqual({ platformFeeCredits: 99, teacherCredits: 900 });
    expect(applyPlatformFee(1)).toEqual({ platformFeeCredits: 0, teacherCredits: 1 });
  });

  it('supports fee-free transfers', () => {
    expect(applyPlatformFee(500, 0)).toEqual({ platformFeeCredits: 0, teacherCredits: 500 });
  });

  it('rejects non-integer or non-positive amounts', () => {
    expect(() => applyPlatformFee(0)).toThrow(RangeError);
    expect(() => applyPlatformFee(-5)).toThrow(RangeError);
    expect(() => applyPlatformFee(1.5)).toThrow(RangeError);
    expect(() => applyPlatformFee(100, -1)).toThrow(RangeError);
    expect(() => applyPlatformFee(100, 10_001)).toThrow(RangeError);
  });

  it('allows withdrawals only from an active wallet', () => {
    expect(canWithdraw('active')).toBe(true);
    expect(canWithdraw('frozen')).toBe(false);
    expect(canWithdraw('closed')).toBe(false);
  });
});
`;
}

function recordPortTemplate() {
  return `export const RECORD_BOOKING_CONFIRMED = Symbol('RECORD_BOOKING_CONFIRMED');

export interface BookingConfirmedInput {
  bookingId: string;
  studentId: string;
  teacherId: string;
  amountCredits: number;
}

export interface RecordBookingConfirmedResult {
  recorded: boolean;
  teacherCredits: number;
  platformFeeCredits: number;
}

export interface RecordBookingConfirmedPort {
  execute(event: BookingConfirmedInput): Promise<RecordBookingConfirmedResult>;
}
`;
}

function ledgerWriterPortTemplate() {
  return `export const LEDGER_ENTRY_WRITER = Symbol('LEDGER_ENTRY_WRITER');

export interface CreditTeacherRequest {
  bookingId: string;
  teacherId: string;
  amountCredits: number;
}

export interface CreditTeacherResult {
  recorded: boolean;
  amountCredits: number;
}

export interface LedgerEntryWriter {
  creditTeacher(request: CreditTeacherRequest): Promise<CreditTeacherResult>;
}
`;
}

function recordUseCaseTemplate() {
  return `import { applyPlatformFee } from '../domain/wallet';
import type {
  BookingConfirmedInput,
  RecordBookingConfirmedPort,
  RecordBookingConfirmedResult,
} from './port/in/record-booking-confirmed';
import type { LedgerEntryWriter } from './port/out/ledger-entry-writer';

/** Applies the platform fee split and credits the teacher's ledger (idempotent). */
export class RecordBookingConfirmedUseCase implements RecordBookingConfirmedPort {
  constructor(private readonly ledger: LedgerEntryWriter) {}

  async execute(event: BookingConfirmedInput): Promise<RecordBookingConfirmedResult> {
    const { platformFeeCredits, teacherCredits } = applyPlatformFee(event.amountCredits);
    const outcome = await this.ledger.creditTeacher({
      bookingId: event.bookingId,
      teacherId: event.teacherId,
      amountCredits: teacherCredits,
    });
    return { recorded: outcome.recorded, teacherCredits, platformFeeCredits };
  }
}
`;
}

function recordUseCaseSpecTemplate() {
  return `import { RecordBookingConfirmedUseCase } from './record-booking-confirmed.use-case';
import type { LedgerEntryWriter } from './port/out/ledger-entry-writer';

describe('RecordBookingConfirmedUseCase', () => {
  function setup(recorded = true) {
    const creditTeacher = jest.fn().mockResolvedValue({ recorded, amountCredits: 900 });
    const ledger: LedgerEntryWriter = { creditTeacher };
    return { useCase: new RecordBookingConfirmedUseCase(ledger), creditTeacher };
  }

  it('splits the fee and credits the teacher', async () => {
    const { useCase, creditTeacher } = setup();
    const result = await useCase.execute({
      bookingId: 'bk-1',
      studentId: 'st-1',
      teacherId: 'tc-1',
      amountCredits: 1000,
    });
    expect(creditTeacher).toHaveBeenCalledWith({
      bookingId: 'bk-1',
      teacherId: 'tc-1',
      amountCredits: 900,
    });
    expect(result).toEqual({ recorded: true, teacherCredits: 900, platformFeeCredits: 100 });
  });

  it('reports duplicate bookings without crediting again', async () => {
    const { useCase } = setup(false);
    const result = await useCase.execute({
      bookingId: 'bk-1',
      studentId: 'st-1',
      teacherId: 'tc-1',
      amountCredits: 400,
    });
    expect(result).toEqual({ recorded: false, teacherCredits: 360, platformFeeCredits: 40 });
  });

  it('rejects invalid amounts before touching the ledger', async () => {
    const { useCase, creditTeacher } = setup();
    await expect(
      useCase.execute({ bookingId: 'bk-2', studentId: 'st-1', teacherId: 'tc-1', amountCredits: 0 }),
    ).rejects.toThrow(RangeError);
    expect(creditTeacher).not.toHaveBeenCalled();
  });

  it('propagates ledger failures', async () => {
    const { useCase, creditTeacher } = setup();
    creditTeacher.mockRejectedValue(new Error('db down'));
    await expect(
      useCase.execute({ bookingId: 'bk-3', studentId: 'st-1', teacherId: 'tc-1', amountCredits: 100 }),
    ).rejects.toThrow('db down');
  });
});
`;
}

function sqlLedgerWriterTemplate() {
  return `import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  CreditTeacherRequest,
  CreditTeacherResult,
  LedgerEntryWriter,
} from '../../../application/port/out/ledger-entry-writer';

const LEDGER_TABLE = 'ledger_entries';
const CREDITED_EVENT = 'wallet.credited';

export class SqlLedgerEntryWriter implements LedgerEntryWriter {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  async creditTeacher(request: CreditTeacherRequest): Promise<CreditTeacherResult> {
    const source = this.registry.get(this.moduleName);
    const schema = this.registry.getSchema(this.moduleName);
    const table = qualified(schema, LEDGER_TABLE);
    return source.transaction(async (manager) => {
      const inserted = (await manager.query(
        \`INSERT INTO \${table} ("booking_id", "teacher_id", "amount_credits", "direction") ` +
          `VALUES ($1, $2, $3, 'credit') ON CONFLICT ("booking_id") DO NOTHING RETURNING "id"\`,
        [request.bookingId, request.teacherId, request.amountCredits],
      )) as Array<{ id: string | number }>;
      if (inserted.length === 0) {
        return { recorded: false, amountCredits: request.amountCredits };
      }
      await manager.query(insertOutboxStatement(schema), [
        CREDITED_EVENT,
        {
          bookingId: request.bookingId,
          teacherId: request.teacherId,
          amountCredits: request.amountCredits,
          creditedAt: new Date().toISOString(),
        },
      ]);
      return { recorded: true, amountCredits: request.amountCredits };
    });
  }
}
`;
}

for (const m of MODULES) {
  const firstTarget = m.transitions[m.initial][0];
  const illegalTo = illegalFromInitial(m);

  emit(m.folder, `internal/domain/module-status.ts`, domainTemplate(m));
  emit(m.folder, `internal/domain/module-status.spec.ts`, domainSpecTemplate(m));
  emit(m.folder, `internal/application/port/in/advance-status.ts`, advancePortTemplate());
  emit(m.folder, `internal/application/port/in/get-module-status.ts`, getPortTemplate());
  emit(m.folder, `internal/application/port/out/module-status-reader.ts`, readerPortTemplate());
  emit(m.folder, `internal/application/port/out/module-status-writer.ts`, writerPortTemplate());
  emit(m.folder, `internal/application/advance-status.use-case.ts`, useCaseTemplate(m, firstTarget));
  emit(
    m.folder,
    `internal/application/advance-status.use-case.spec.ts`,
    useCaseSpecTemplate(m, firstTarget, illegalTo),
  );
  emit(m.folder, `internal/application/query/get-module-status.query.ts`, queryTemplate());
  emit(m.folder, `internal/adapter/in/web/status.controller.ts`, controllerTemplate(m));
  emit(m.folder, `internal/adapter/out/persistence/schema.ts`, schemaTemplate(m));
  emit(m.folder, `internal/adapter/out/persistence/data-source.ts`, dataSourceTemplate());
  emit(
    m.folder,
    `internal/adapter/out/persistence/migrations/${MIGRATION_FILE}.ts`,
    migrationTemplate(m),
  );
  emit(m.folder, `internal/adapter/out/persistence/sql-module-status-reader.ts`, sqlReaderTemplate());
  emit(m.folder, `internal/adapter/out/persistence/sql-module-status-writer.ts`, sqlWriterTemplate());
  emit(m.folder, `${m.folder}.module.ts`, moduleTemplate(m));
  emit(m.folder, `api/index.ts`, apiIndexTemplate(m));

  if (m.extras) {
    emit(m.folder, `internal/domain/wallet.ts`, walletDomainTemplate());
    emit(m.folder, `internal/domain/wallet.spec.ts`, walletDomainSpecTemplate());
    emit(m.folder, `internal/application/port/in/record-booking-confirmed.ts`, recordPortTemplate());
    emit(m.folder, `internal/application/port/out/ledger-entry-writer.ts`, ledgerWriterPortTemplate());
    emit(m.folder, `internal/application/record-booking-confirmed.use-case.ts`, recordUseCaseTemplate());
    emit(
      m.folder,
      `internal/application/record-booking-confirmed.use-case.spec.ts`,
      recordUseCaseSpecTemplate(),
    );
    emit(m.folder, `internal/adapter/out/persistence/sql-ledger-entry-writer.ts`, sqlLedgerWriterTemplate());
  }
}

console.log(`Generated ${written.length} files, skipped ${skipped.length} existing (use --force to overwrite).`);
for (const path of written) {
  console.log(`  + ${path}`);
}
if (skipped.length > 0) {
  console.log('Skipped:');
  for (const path of skipped) {
    console.log(`  ~ ${path}`);
  }
}
