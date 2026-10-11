import type { StudentVerificationEvent } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import { VERIFIED_STUDENT_READER } from '../../../application/port/out/verified-student-reader';

export { VERIFIED_STUDENT_READER };

/**
 * FR-003 / ADR-024: the skill-verification module's local projection of the student
 * verification status. The event consumer writes it (`upsert`, last-writer-wins by
 * `occurredAt`); the submit use case reads it (`isVerifiedStudent`). No cross-schema
 * access (ADR-014).
 */
export class SqlVerifiedStudentProjector {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'verified_students');
  }

  async upsert(event: Pick<StudentVerificationEvent, 'accountId' | 'status' | 'occurredAt'>): Promise<void> {
    const source = this.registry.get(this.moduleName);
    await source.query(
      `INSERT INTO ${this.table} ("account_id", "status", "occurred_at", "updated_at")
       VALUES ($1, $2, $3, now())
       ON CONFLICT ("account_id") DO UPDATE
         SET "status" = EXCLUDED."status",
             "occurred_at" = EXCLUDED."occurred_at",
             "updated_at" = now()
       WHERE ${this.table}."occurred_at" < EXCLUDED."occurred_at"`,
      [event.accountId, event.status, event.occurredAt],
    );
  }

  async isVerifiedStudent(accountId: string): Promise<boolean> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "status" FROM ${this.table} WHERE "account_id" = $1`,
      [accountId],
    )) as { status: string }[];
    return rows[0]?.status === 'approved';
  }
}
