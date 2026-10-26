import { accountStatusChangedSchema } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import type { Account, AccountRole, AccountStatus } from '../../../domain/account';
import { normalizeEmail } from '../../../domain/account';
import type {
  AccountLockListQuery,
  AccountLockRepository,
  AccountRepository,
  ChangeAccountStatusCommand,
  LockedAccountRecord,
  NewAccount,
} from '../../../application/port/out/account-repository';

interface AccountRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  created_at: Date | string;
  suspended_reason?: string | null;
  suspended_by?: string | null;
  suspended_at?: Date | string | null;
}

interface LockedAccountRow extends AccountRow {
  suspended_reason: string;
  suspended_by: string | null;
  suspended_at: Date | string;
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toAccount(row: AccountRow): Account {
  const suspendedAt = toIso(row.suspended_at);
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as AccountRole,
    status: row.status as AccountStatus,
    createdAt: toIso(row.created_at) as string,
    // ADR-037: the suspension detail exists only while the account is suspended. The database
    // constraint guarantees this, so the read does not need to invent a placeholder.
    ...(row.suspended_reason == null || suspendedAt === null
      ? {}
      : {
          suspension: {
            reason: row.suspended_reason,
            suspendedBy: row.suspended_by ?? null,
            suspendedAt,
          },
        }),
  };
}

function toLockedAccount(row: LockedAccountRow): LockedAccountRecord {
  return {
    accountId: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    reason: row.suspended_reason,
    suspendedBy: row.suspended_by,
    suspendedAt: toIso(row.suspended_at) as string,
  };
}

const ACCOUNT_COLUMNS =
  '"id", "email", "display_name", "role", "status", "created_at", ' +
  '"suspended_reason", "suspended_by", "suspended_at"';

export class SqlAccountRepository implements AccountRepository, AccountLockRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'accounts');
  }

  async create(input: NewAccount): Promise<Account> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `INSERT INTO ${this.table} ("email", "display_name", "role", "status")
       VALUES ($1, $2, $3, $4)
       RETURNING ${ACCOUNT_COLUMNS}`,
      [normalizeEmail(input.email), input.displayName, input.role, input.status],
    )) as AccountRow[];
    return toAccount(rows[0]);
  }

  async findByEmail(email: string): Promise<Account | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${ACCOUNT_COLUMNS}
       FROM ${this.table} WHERE lower("email") = lower($1) LIMIT 1`,
      [email],
    )) as AccountRow[];
    return rows[0] === undefined ? null : toAccount(rows[0]);
  }

  async findById(id: string): Promise<Account | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT ${ACCOUNT_COLUMNS} FROM ${this.table} WHERE "id" = $1 LIMIT 1`,
      [id],
    )) as AccountRow[];
    return rows[0] === undefined ? null : toAccount(rows[0]);
  }

  /**
   * FR-015 / OQ-015 / ADR-037: sets an account's status **and** emits the audited event in the same
   * transaction (ADR-013), so the audit log can never record a lock that did not commit, nor miss
   * one that did.
   *
   * Returns `null` when the account does not exist, and the unchanged record when the status is
   * already what was asked for — so a repeated suspend is a no-op rather than a second audit row.
   */
  async changeStatus(
    command: ChangeAccountStatusCommand,
  ): Promise<{ account: Account; changed: boolean } | null> {
    const source = this.registry.get(this.moduleName);
    return source.transaction(async (manager) => {
      // Read first: `RETURNING` sees the post-update row and cannot report what the status *was*,
      // and the audit row needs the old→new pair.
      const current = (
        await manager.query(`SELECT "status" FROM ${this.table} WHERE "id" = $1 FOR UPDATE`, [
          command.accountId,
        ])
      ) as { status: string }[];
      const previousStatus = current[0]?.status as AccountStatus | undefined;
      if (previousStatus === undefined) {
        return null;
      }
      if (previousStatus === command.status) {
        const unchanged = (await manager.query(
          `SELECT ${ACCOUNT_COLUMNS} FROM ${this.table} WHERE "id" = $1`,
          [command.accountId],
        )) as AccountRow[];
        return { account: toAccount(unchanged[0]), changed: false };
      }

      const suspended = command.status === 'suspended';
      // `returnedRows` exists for exactly this: an `UPDATE ... RETURNING` on a transactional
      // manager yields `[rows, count]`, so indexing the raw result gives the row array, not a row —
      // `row.id` would be `undefined` and the audited payload would fail its own schema (ADR-035
      // Amendment A caught this, which is why the payload is parsed in the writing transaction).
      const row = returnedRows<AccountRow>(await manager.query(
        `UPDATE ${this.table}
            SET "status" = $2,
                "suspended_reason" = $3,
                "suspended_by" = $4,
                "suspended_at" = $5,
                "updated_at" = now()
          WHERE "id" = $1
          RETURNING ${ACCOUNT_COLUMNS}`,
        [
          command.accountId,
          command.status,
          suspended ? command.reason : null,
          suspended ? command.actorId : null,
          suspended ? command.occurredAt.toISOString() : null,
        ],
      ))[0];
      if (row === undefined) {
        // Unreachable after `FOR UPDATE` found the row, but a silent `undefined` here would put a
        // malformed payload in the outbox — the failure must be loud, not dead-lettered later.
        throw new Error(`Account ${command.accountId} disappeared during the status change`);
      }

      await manager.query(insertOutboxStatement(this.registry.getSchema(this.moduleName)), [
        'account.status.changed',
        // ADR-035 Amendment A: validated at the emitter, in the writing transaction, so a payload
        // that the consumer would reject fails here instead of dead-lettering later.
        accountStatusChangedSchema.parse({
          accountId: row.id,
          status: command.status,
          previousStatus,
          reason: suspended ? command.reason : null,
          occurredAt: command.occurredAt.toISOString(),
          // ADR-035: the Administrator who acted. `accountId` above is the subject.
          actorId: command.actorId,
        }),
      ]);

      return { account: toAccount(row), changed: true };
    });
  }

  /**
   * FR-015 / ADR-037 phase 3: the account-lock list. Keyset paginated on `(suspended_at, id)`
   * descending, which the partial index `ix_accounts_status_suspended_at` serves.
   */
  async listSuspended(query: AccountLockListQuery): Promise<LockedAccountRecord[]> {
    const source = this.registry.get(this.moduleName);
    const limit = query.limit;
    const cursor = query.cursor;
    if (cursor === undefined) {
      const rows = (await source.query(
        `SELECT ${ACCOUNT_COLUMNS} FROM ${this.table}
          WHERE "status" = 'suspended'
          ORDER BY "suspended_at" DESC, "id" DESC
          LIMIT $1`,
        [limit],
      )) as LockedAccountRow[];
      return rows.map(toLockedAccount);
    }
    const rows = (await source.query(
      `SELECT ${ACCOUNT_COLUMNS} FROM ${this.table}
        WHERE "status" = 'suspended'
          AND ("suspended_at", "id") < ($1::timestamptz, $2::uuid)
        ORDER BY "suspended_at" DESC, "id" DESC
        LIMIT $3`,
      [cursor.suspendedAt.toISOString(), cursor.accountId, limit],
    )) as LockedAccountRow[];
    return rows.map(toLockedAccount);
  }

  async countSuspended(): Promise<number> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT COUNT(*)::int AS total FROM ${this.table} WHERE "status" = 'suspended'`,
    )) as { total: number }[];
    return rows[0]?.total ?? 0;
  }
}
