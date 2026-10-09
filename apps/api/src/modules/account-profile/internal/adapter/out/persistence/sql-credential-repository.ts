import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type { PasswordHash } from '../../../domain/credential';
import type { CredentialRepository } from '../../../application/port/out/credential-repository';

export class SqlCredentialRepository implements CredentialRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'account_credentials');
  }

  async save(accountId: string, hash: PasswordHash): Promise<void> {
    const source = this.registry.get(this.moduleName);
    await source.query(
      `INSERT INTO ${this.table} ("account_id", "algorithm", "salt", "hash", "key_length", "updated_at")
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT ("account_id") DO UPDATE
         SET "algorithm" = EXCLUDED."algorithm",
             "salt" = EXCLUDED."salt",
             "hash" = EXCLUDED."hash",
             "key_length" = EXCLUDED."key_length",
             "updated_at" = now()`,
      [accountId, hash.algorithm, hash.salt, hash.hash, hash.keyLength],
    );
  }

  async findByAccountId(accountId: string): Promise<PasswordHash | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "algorithm", "salt", "hash", "key_length" FROM ${this.table} WHERE "account_id" = $1 LIMIT 1`,
      [accountId],
    )) as Array<{ algorithm: string; salt: string; hash: string; key_length: number }>;
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      algorithm: 'scrypt',
      salt: row.salt,
      hash: row.hash,
      keyLength: row.key_length,
    };
  }
}
