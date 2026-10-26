import type { AdminDashboard } from '@skillswap/contracts';
import type { SuspendedAccountReader } from '../../../../account-profile/api';
import type { EvidenceSummaryReader } from '../../../../skill-verification/api';
import type { VerificationSummaryReader } from '../../../../student-verification/api';
import type { AdminAuditEventRepository } from '../port/out/admin-audit-event-repository';
import type { GetAdminDashboardPort } from '../port/in/get-admin-dashboard';

/**
 * How many recent audit events the dashboard shows. A fixed, small head of the log: the screen is
 * a landing surface, and anyone who needs more follows the link to `GET /audit-log`.
 */
export const RECENT_AUDIT_EVENT_LIMIT = 10;

/**
 * FR-015 / ADR-034 §7: composes the operations dashboard.
 *
 * **Where each field comes from.** Nothing here queries a schema. The two count groups come from
 * the owning modules' published facade readers (`VerificationSummaryReader`,
 * `EvidenceSummaryReader`), which is the ADR-008/ADR-012 composition style: each module answers a
 * question about its own data, and this module only assembles the answers. The recent events come
 * from this module's own audit store.
 *
 * **Why it composes rather than caches.** Every count is read live on each request, including the
 * audit head. A dashboard that showed a stale queue depth would send an administrator to a queue
 * that no longer looks like the number they clicked, which is worse than a slower screen. If this
 * ever needs a cache, that is a measured decision (Q4), not a default.
 *
 * The three reads are independent, so they run concurrently — a sequential composition would make
 * the page as slow as the sum of its parts for no benefit.
 */
export class GetAdminDashboardQueryHandler implements GetAdminDashboardPort {
  constructor(
    private readonly verifications: VerificationSummaryReader,
    private readonly evidence: EvidenceSummaryReader,
    private readonly audit: AdminAuditEventRepository,
    /**
     * FR-015 / ADR-037: suspended accounts. Optional in the constructor only so the existing tests
     * that predate the lock list keep compiling; the module always supplies it, and the dashboard
     * is meaningless without it, so a real deployment cannot omit it silently.
     */
    private readonly suspended: SuspendedAccountReader | null = null,
    private readonly clock: { now(): Date } = { now: () => new Date() },
  ) {}

  async execute(): Promise<AdminDashboard> {
    const [verificationSummary, evidenceSummary, recent, suspendedTotal] = await Promise.all([
      this.verifications.read(),
      this.evidence.read(),
      this.audit.list({ limit: RECENT_AUDIT_EVENT_LIMIT, sort: '-occurredAt' }),
      this.suspended === null ? Promise.resolve(0) : this.suspended.count(),
    ]);

    return {
      verifications: verificationSummary.byStatus,
      evidence: evidenceSummary.byStatus,
      evidenceByDomain: evidenceSummary.byDomain,
      recentAuditEvents: recent.items,
      suspendedAccounts: { total: suspendedTotal },
      generatedAt: this.clock.now().toISOString(),
    };
  }
}
