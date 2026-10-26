/**
 * FR-015: the audited action identifiers and their message keys.
 *
 * Shared by the audit log and the dashboard so one action is never described two
 * ways on two screens — the same reason the audit contract is one shape.
 *
 * `AUDITED_ACTIONS` mirrors the ingest table
 * (`apps/api/src/modules/admin-operation/internal/application/audit-actions.ts`).
 * It is a *closed* list because the `action` filter is a `<select>`: free text would
 * be validated against a dotted-lowercase pattern and a hand-typed `Approve` would
 * be a 400 the operator has to decode. A newly audited behaviour still appears under
 * "all actions" without this list changing.
 *
 * `ACTION_MESSAGE_KEY` exists because next-intl treats `.` as a **key separator**:
 * a message key of `action.student.verification.approved` is read as a four-level
 * path and never resolves, rendering as a raw key string. The message keys are
 * therefore flat camelCase, and this table is the single place the wire identifier
 * and the message key are joined.
 */

/** The dotted action identifiers the ingest table audits today, in display order. */
export const AUDITED_ACTIONS = [
  'student.verification.approved',
  'student.verification.rejected',
  'student.verification.revoked',
  'skill.evidence.claimed',
  'skill.evidence.approved',
  'skill.evidence.rejected',
  'skill.verifier.suspended',
  'skill.verifier.revoked',
  'wallet.transaction.completed',
  'account.status.changed',
] as const;

/** Dotted wire identifier → flat camelCase key under the `Admin.auditLog.action` namespace. */
export const ACTION_MESSAGE_KEY: Record<string, string> = {
  'student.verification.approved': 'studentVerificationApproved',
  'student.verification.rejected': 'studentVerificationRejected',
  'student.verification.revoked': 'studentVerificationRevoked',
  'skill.evidence.claimed': 'skillEvidenceClaimed',
  'skill.evidence.approved': 'skillEvidenceApproved',
  'skill.evidence.rejected': 'skillEvidenceRejected',
  'skill.verifier.suspended': 'skillVerifierSuspended',
  'skill.verifier.revoked': 'skillVerifierRevoked',
  'wallet.transaction.completed': 'walletTransactionCompleted',
  'account.status.changed': 'accountStatusChanged',
};
