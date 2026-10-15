/**
 * FR-015 / ADR-034 §7: the operations dashboard's skill-evidence summary.
 *
 * A **facade port** in the same shape as `account-profile/api/public-profile-reader.ts`. The
 * dashboard asks this module for counts; it cannot read `skill_verification` directly (ADR-014)
 * and cannot import this module's internals (ADR-005/ADR-011).
 *
 * `byDomain` is the field FR-015 cares about: "which domains have unclaimed work and no Verifier
 * covering them" is the operational question, and a per-domain split is what answers it. The map
 * is keyed by taxonomy category and only contains categories that actually have work.
 */
export const EVIDENCE_SUMMARY_READER = Symbol('EVIDENCE_SUMMARY_READER');

export interface EvidenceSummary {
  /** How many evidence rows sit in each status, across every domain. */
  readonly byStatus: Readonly<Record<'pending' | 'claimed' | 'approved' | 'rejected' | 'superseded', number>>;
  /** Live queue depth per taxonomy category: unclaimed (`pending`) + in review (`claimed`). */
  readonly byDomain: Readonly<Record<string, number>>;
  /** The sum of `byStatus`, so a caller does not have to re-add it. */
  readonly total: number;
}

export interface EvidenceSummaryReader {
  read(): Promise<EvidenceSummary>;
}
