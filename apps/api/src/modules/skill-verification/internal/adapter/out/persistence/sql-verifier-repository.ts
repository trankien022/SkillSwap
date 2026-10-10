import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  VerifierRecord,
  VerifierRepository,
} from '../../../application/port/out/skill-evidence-repository';

interface VerifierRow {
  account_id: string;
  status: string;
  expertise: string[] | null;
}

function toDomain(row: VerifierRow): VerifierRecord {
  return {
    accountId: row.account_id,
    status: row.status as VerifierRecord['status'],
    expertise: row.expertise ?? [],
  };
}

/**
 * FR-004 / ADR-027: the Verifier read/write adapter. Expertise is seeded in
 * `verifier_expertise`; a Verifier's lifecycle status lives on `verifiers`.
 */
export class SqlVerifierRepository implements VerifierRepository {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'verifiers');
  }

  private get expertiseTable(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'verifier_expertise');
  }

  async findById(accountId: string): Promise<VerifierRecord | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT v."account_id", v."status",
              COALESCE(
                ARRAY_AGG(e."skill_id") FILTER (WHERE e."skill_id" IS NOT NULL),
                '{}'
              ) AS expertise
         FROM ${this.table} v
         LEFT JOIN ${this.expertiseTable} e ON e."account_id" = v."account_id"
        WHERE v."account_id" = $1
        GROUP BY v."account_id", v."status"`,
      [accountId],
    )) as VerifierRow[];
    return rows[0] === undefined ? null : toDomain(rows[0]);
  }

  async setStatus(
    accountId: string,
    status: 'active' | 'suspended' | 'revoked',
  ): Promise<VerifierRecord | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `UPDATE ${this.table} SET "status" = $2, "updated_at" = now()
        WHERE "account_id" = $1
        RETURNING "account_id", "status"`,
      [accountId, status],
    )) as { account_id: string; status: string }[];
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    const updated = await this.findById(row.account_id);
    return updated;
  }
}
