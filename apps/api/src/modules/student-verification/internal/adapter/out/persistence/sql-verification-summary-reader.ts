import type { VerificationStatus } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  VerificationSummary,
  VerificationSummaryReader,
} from '../../../../api/verification-summary-reader';

const STATUSES: readonly VerificationStatus[] = ['pending', 'approved', 'rejected', 'revoked'];

/**
 * FR-015 / ADR-034 §7: counts student verifications by status for the operations dashboard.
 *
 * One grouped query rather than one per status: the dashboard renders all four counts together,
 * and four round trips to say the same thing is a cost the landing surface should not pay.
 *
 * The statuses that are absent from the result are filled in as zero here, so the dashboard never
 * has to distinguish "no rows" from "not queried" — a caller receiving `{ pending: 3 }` without
 * this would have to guess whether `approved` is unknown or genuinely zero.
 */
export class SqlVerificationSummaryReader implements VerificationSummaryReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get table(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'student_verifications');
  }

  async read(): Promise<VerificationSummary> {
    const source = this.registry.get(this.moduleName);
    const rows = (await source.query(
      `SELECT "status", COUNT(*)::int AS "count" FROM ${this.table} GROUP BY "status"`,
    )) as Array<{ status: string; count: number }>;

    const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
      VerificationStatus,
      number
    >;
    for (const row of rows) {
      // An unknown status in the table is ignored rather than crashing the dashboard: this read
      // must not be the thing that takes down the landing page if a row predates a status change.
      if (STATUSES.includes(row.status as VerificationStatus)) {
        byStatus[row.status as VerificationStatus] = row.count;
      }
    }

    return {
      byStatus,
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    };
  }
}
