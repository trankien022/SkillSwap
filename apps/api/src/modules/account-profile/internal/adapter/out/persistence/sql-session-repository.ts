import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { Session } from '../../../domain/session';
import type { NewSession, SessionRepository } from '../../../application/port/out/session-repository';

interface SessionRow {
  id: string;
  account_id: string;
  refresh_token_hash: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  created_at: Date | string;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    accountId: row.account_id,
    refreshTokenHash: row.refresh_token_hash,
    expiresAt: iso(row.expires_at),
    revokedAt: row.revoked_at === null ? null : iso(row.revoked_at),
    createdAt: iso(row.created_at),
  };
}

export class SqlSessionRepository implements SessionRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'sessions');
  }

  async create(input: NewSession): Promise<Session> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `INSERT INTO ${this.table} ("account_id", "refresh_token_hash", "expires_at")
       VALUES ($1, $2, $3)
       RETURNING "id", "account_id", "refresh_token_hash", "expires_at", "revoked_at", "created_at"`,
      [input.accountId, input.refreshTokenHash, input.expiresAt],
    )) as SessionRow[];
    return toSession(rows[0]);
  }

  async findByTokenHash(refreshTokenHash: string): Promise<Session | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "id", "account_id", "refresh_token_hash", "expires_at", "revoked_at", "created_at"
       FROM ${this.table} WHERE "refresh_token_hash" = $1 LIMIT 1`,
      [refreshTokenHash],
    )) as SessionRow[];
    return rows[0] === undefined ? null : toSession(rows[0]);
  }

  async revoke(id: string): Promise<void> {
    const source = this.registry.get(this.moduleName);
    await source.query(
      `UPDATE ${this.table} SET "revoked_at" = now() WHERE "id" = $1 AND "revoked_at" IS NULL`,
      [id],
    );
  }

  async revokeAllForAccount(accountId: string): Promise<void> {
    const source = this.registry.get(this.moduleName);
    await source.query(
      `UPDATE ${this.table} SET "revoked_at" = now() WHERE "account_id" = $1 AND "revoked_at" IS NULL`,
      [accountId],
    );
  }
}
