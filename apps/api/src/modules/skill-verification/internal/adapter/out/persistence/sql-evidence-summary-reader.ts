import type { EvidenceStatus } from '@skillswap/contracts';
import type { ModuleDataSourceRegistry } from '../../../../../../shared/messaging/module-registry';
import { qualified } from '../../../../../../shared/sql/ident';
import type {
  EvidenceSummary,
  EvidenceSummaryReader,
} from '../../../../api/evidence-summary-reader';

const STATUSES: readonly EvidenceStatus[] = [
  'pending',
  'claimed',
  'approved',
  'rejected',
  'superseded',
];

/** The statuses that describe live queue work, as opposed to decisions already taken. */
const QUEUE_STATUSES: readonly EvidenceStatus[] = ['pending', 'claimed'];

/**
 * FR-015 / ADR-034 §7: counts skill evidence by status and by domain for the dashboard.
 *
 * Two grouped queries, both against this module's own schema (ADR-014) and both parameterised:
 *
 * - `byStatus` answers "how much work is outstanding overall".
 * - `byDomain` answers the operational question the administrator actually has: *which domain has
 *   live work* — so it sums only the two queue statuses, because a domain whose every request is
 *   decided has no queue to look at.
 *
 * Absent keys are filled with zero, matching `SqlVerificationSummaryReader`: the dashboard must
 * not have to distinguish "no rows" from "not queried".
 */
export class SqlEvidenceSummaryReader implements EvidenceSummaryReader {
  constructor(
    private readonly registry: ModuleDataSourceRegistry,
    private readonly moduleName: string,
  ) {}

  private get evidenceTable(): string {
    return qualified(this.registry.getSchema(this.moduleName), 'skill_evidence');
  }

  async read(): Promise<EvidenceSummary> {
    const source = this.registry.get(this.moduleName);

    const [statusRows, domainRows] = await Promise.all([
      source.query(
        `SELECT "status", COUNT(*)::int AS "count" FROM ${this.evidenceTable} GROUP BY "status"`,
      ) as Promise<Array<{ status: string; count: number }>>,
      source.query(
        `SELECT s."category" AS "category", COUNT(*)::int AS "count"
           FROM ${this.evidenceTable} e
           JOIN ${qualified(this.registry.getSchema(this.moduleName), 'profile_skills')} ps
             ON ps."id" = e."profile_skill_id"
           JOIN ${qualified(this.registry.getSchema(this.moduleName), 'skills')} s
             ON s."id" = ps."skill_id"
          WHERE e."status" = ANY($1::text[])
          GROUP BY s."category"`,
        [QUEUE_STATUSES],
      ) as Promise<Array<{ category: string; count: number }>>,
    ]);

    const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
      EvidenceStatus,
      number
    >;
    for (const row of statusRows) {
      if (STATUSES.includes(row.status as EvidenceStatus)) {
        byStatus[row.status as EvidenceStatus] = row.count;
      }
    }

    // Only categories that actually carry queue work appear; the dashboard shows the map as-is so
    // a domain with no work is simply absent rather than a row of zeroes.
    const byDomain: Record<string, number> = {};
    for (const row of domainRows) {
      byDomain[row.category] = row.count;
    }

    return {
      byStatus,
      byDomain,
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    };
  }
}
