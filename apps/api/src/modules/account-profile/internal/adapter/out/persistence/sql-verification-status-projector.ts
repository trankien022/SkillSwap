import type { AccountVerificationStatus } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  ProjectedVerificationStatus,
  UpsertVerificationStatusRequest,
  VerificationStatusReader,
  VerificationStatusWriter,
} from '../../../application/port/out/verification-status-projector';

interface StatusRow {
  status: string;
  reason: string | null;
}

/**
 * FR-017 / ADR-024: the account-profile module's local projection of the
 * student verification status. Written by the event consumer, read owner-scoped.
 */
export class SqlVerificationStatusProjector
  implements VerificationStatusReader, VerificationStatusWriter
{
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'account_verification_status');
  }

  async findByAccount(accountId: string): Promise<ProjectedVerificationStatus | null> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "status", "reason" FROM ${this.table} WHERE "account_id" = $1`,
      [accountId],
    )) as StatusRow[];
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return { status: row.status as AccountVerificationStatus, reason: row.reason };
  }

  async upsert(request: UpsertVerificationStatusRequest): Promise<void> {
    const source = this.registry.get(this.moduleName);
    await source.query(
      `INSERT INTO ${this.table}
         ("account_id", "status", "reason", "verification_id", "occurred_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT ("account_id") DO UPDATE
         SET "status" = EXCLUDED."status",
             "reason" = EXCLUDED."reason",
             "verification_id" = EXCLUDED."verification_id",
             "occurred_at" = EXCLUDED."occurred_at",
             "updated_at" = now()
       WHERE ${this.table}."occurred_at" < EXCLUDED."occurred_at"`,
      [request.accountId, request.status, request.reason, request.verificationId, request.occurredAt],
    );
  }
}
