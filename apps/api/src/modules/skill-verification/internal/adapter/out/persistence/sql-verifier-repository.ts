import { insertOutboxStatement } from '../../../../../../shared/messaging/outbox-statements';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { returnedRows } from '../../../../../../shared/sql/result';
import { VERIFIER_EVENTS } from '../../../domain/verifier';
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

  /**
   * FR-004 / ADR-027 + FR-015 / ADR-013: sets a Verifier's lifecycle status and emits the
   * matching event **in the same transaction**, so the audit log can never record a change that
   * did not commit (nor miss one that did).
   *
   * The event carries the previous status because that old→new pair is what FR-015's audit row
   * has to show; deriving it later would mean reading a table that has already moved on.
   */
  async setStatus(
    accountId: string,
    status: 'active' | 'suspended' | 'revoked',
  ): Promise<VerifierRecord | null> {
    const source = this.registry.get(this.moduleName);
    const schema = this.registry.getSchema(this.moduleName);

    const changed = await source.transaction(async (manager) => {
      // Read the current status first: `RETURNING` sees the post-update row, so it cannot tell
      // us what the status *was*, and the audit row needs the old→new pair.
      const current = returnedRows<{ status: string }>(
        await manager.query(`SELECT "status" FROM ${this.table} WHERE "account_id" = $1 FOR UPDATE`, [
          accountId,
        ]),
      )[0];
      if (current === undefined) {
        return null;
      }

      const rows = returnedRows<{ account_id: string; previous_status: string }>(
        await manager.query(
          `UPDATE ${this.table} SET "status" = $2, "updated_at" = now()
            WHERE "account_id" = $1
            RETURNING "account_id", $3::text AS previous_status`,
          [accountId, status, current.status],
        ),
      );
      const row = rows[0];
      if (row === undefined) {
        return null;
      }
      // Only the demoting transitions are audited; reactivation emits nothing, so no event type
      // is computed for it. (A reactivation is itself worth auditing later, but that is a
      // separate behaviour change, not something to smuggle into this one.)
      if (status !== 'active') {
        const eventType =
          status === 'suspended' ? VERIFIER_EVENTS.suspended : VERIFIER_EVENTS.revoked;
        await manager.query(insertOutboxStatement(schema), [
          eventType,
          {
            verifierId: row.account_id,
            status,
            previousStatus: row.previous_status,
            occurredAt: new Date().toISOString(),
          },
        ]);
      }
      return row.account_id;
    });

    if (changed === null) {
      return null;
    }
    return this.findById(accountId);
  }
}
