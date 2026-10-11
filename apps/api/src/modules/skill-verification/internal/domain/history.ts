/**
 * FR-018 / ADR-028: evidence decision history and the reusable audit contract.
 *
 * Every lifecycle change to a `skill_evidence` version appends an immutable audit
 * entry in the same transaction (BR-014, NFR-005). Evidence **content** never
 * changes after submission; corrections are new versions. Framework-free.
 */

import type { EvidenceStatus, EvidenceType, SkillLevel } from './evidence';

/** Actions that append an audit entry for an evidence version. */
export const EVIDENCE_AUDIT_ACTIONS = [
  'submitted',
  'claimed',
  'approved',
  'rejected',
  'superseded',
] as const;
export type EvidenceAuditAction = (typeof EVIDENCE_AUDIT_ACTIONS)[number];

export function isEvidenceAuditAction(value: string): value is EvidenceAuditAction {
  return (EVIDENCE_AUDIT_ACTIONS as readonly string[]).includes(value);
}

/** The whitelisted, decision-relevant snapshot stored with an audit entry (NFR-005). */
export interface EvidenceAuditSnapshot {
  readonly version: number;
  readonly status: EvidenceStatus;
  readonly evidenceType: EvidenceType;
  readonly requestedLevel: SkillLevel;
  readonly approvedLevel: SkillLevel | null;
  readonly reason: string | null;
}

/**
 * FR-018 / ADR-028 §1: an append-only audit entry for one evidence version. `actorId`
 * is the account that caused the change (`null` for a system action). `traceId` links
 * related changes. Never carries document contents (NFR-005).
 */
export interface EvidenceAuditEntry {
  readonly id: string;
  readonly evidenceId: string;
  readonly profileSkillId: string;
  readonly version: number;
  readonly action: EvidenceAuditAction;
  readonly actorId: string | null;
  readonly fromStatus: EvidenceStatus | null;
  readonly toStatus: EvidenceStatus;
  readonly reason: string | null;
  readonly snapshot: EvidenceAuditSnapshot;
  readonly occurredAt: Date;
  readonly traceId: string | null;
}

/** A profile-skill's history: one group per evidence version, newest version first. */
export interface EvidenceVersionHistory {
  readonly version: number;
  readonly evidenceId: string;
  readonly currentStatus: EvidenceStatus;
  readonly requestedLevel: SkillLevel;
  readonly approvedLevel: SkillLevel | null;
  readonly submittedAt: Date;
  readonly entries: readonly EvidenceAuditEntry[];
}

/** A new audit entry to append. */
export interface NewEvidenceAuditEntry {
  readonly id: string;
  readonly evidenceId: string;
  readonly profileSkillId: string;
  readonly version: number;
  readonly action: EvidenceAuditAction;
  readonly actorId: string | null;
  readonly fromStatus: EvidenceStatus | null;
  readonly toStatus: EvidenceStatus;
  readonly reason: string | null;
  readonly snapshot: EvidenceAuditSnapshot;
  readonly occurredAt: Date;
  readonly traceId: string | null;
}
