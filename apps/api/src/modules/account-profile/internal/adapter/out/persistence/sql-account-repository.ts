import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { Account, AccountRole, AccountStatus } from '../../../domain/account';
import { normalizeEmail } from '../../../domain/account';
import type { AccountRepository, NewAccount } from '../../../application/port/out/account-repository';

interface AccountRow {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  created_at: Date | string;
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as AccountRole,
    status: row.status as AccountStatus,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

export class SqlAccountRepository implements AccountRepository {
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
       RETURNING "id", "email", "display_name", "role", "status", "created_at"`,
      [normalizeEmail(input.email), input.displayName, input.role, input.status],
    )) as AccountRow[];
    return toAccount(rows[0]);
  }

  async findByEmail(email: string): Promise<Account | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "id", "email", "display_name", "role", "status", "created_at"
       FROM ${this.table} WHERE lower("email") = lower($1) LIMIT 1`,
      [email],
    )) as AccountRow[];
    return rows[0] === undefined ? null : toAccount(rows[0]);
  }

  async findById(id: string): Promise<Account | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "id", "email", "display_name", "role", "status", "created_at"
       FROM ${this.table} WHERE "id" = $1 LIMIT 1`,
      [id],
    )) as AccountRow[];
    return rows[0] === undefined ? null : toAccount(rows[0]);
  }
}
