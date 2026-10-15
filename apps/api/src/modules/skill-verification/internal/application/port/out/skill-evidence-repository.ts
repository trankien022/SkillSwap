import type { EvidenceType, ProfileSkill, SkillEvidence, SkillLevel } from '../../../domain/evidence';
import type { EvidenceAuditEntry } from '../../../domain/history';

export const PROFILE_SKILL_REPOSITORY = Symbol('ProfileSkillRepository');
export const SKILL_EVIDENCE_REPOSITORY = Symbol('SkillEvidenceRepository');
export const VERIFIER_REPOSITORY = Symbol('VerifierRepository');

/** FR-003: a profile-skill joined with its catalogue entry, for the owner view. */
export interface ProfileSkillWithSkill {
  readonly id: string;
  readonly skillId: string;
  readonly skillName: string;
  readonly category: string;
  readonly approvedLevel: SkillLevel | null;
}

/** FR-003 / NFR-014: optional filter/sort for the owner's profile-skill list. */
export interface ListProfileSkillsQuery {
  readonly q?: string;
  readonly sort?: 'category' | 'name' | '-approvedLevel';
}

export interface ProfileSkillRepository {
  /** The account's existing link to a skill, or null. */
  findByAccountAndSkill(accountId: string, skillId: string): Promise<ProfileSkill | null>;
  /** The profile skill by its own id, or null. */
  findById(profileSkillId: string): Promise<ProfileSkill | null>;
  /** All of the account's profile skills joined with their catalogue entries (filtered/sorted). */
  listByAccount(accountId: string, query?: ListProfileSkillsQuery): Promise<ProfileSkillWithSkill[]>;
  /**
   * Returns the account↔skill link, creating it (level NULL) if the account has
   * never linked this skill (ADR-026 §5).
   */
  findOrCreate(accountId: string, skillId: string): Promise<ProfileSkill>;
  /**
   * FR-004 / AC-016: sets the cached effective approved level and supersedes the
   * previous approved evidence, atomically with the decision (BR-013).
   */
  applyApprovedLevel(profileSkillId: string, level: SkillLevel | null): Promise<void>;
}

/** A new evidence version to persist. */
export interface CreateSkillEvidenceRequest {
  readonly id: string;
  readonly profileSkillId: string;
  readonly evidenceType: SkillEvidence['evidenceType'];
  readonly documentRef: string | null;
  readonly description: string | null;
  readonly requestedLevel: SkillLevel;
  readonly accountId: string;
  readonly skillId: string;
  readonly submittedAt: Date;
}

/** FR-004: a pending request in a Verifier's expertise-scoped queue (with context). */
export interface PendingEvidenceForVerifier {
  readonly id: string;
  readonly profileSkillId: string;
  readonly skillId: string;
  readonly skillName: string;
  readonly category: string;
  readonly ownerId: string;
  readonly evidence: SkillEvidence;
}

/** FR-004 / NFR-014: filters, sort and keyset window for the verifier queue. */
export interface PendingQueueQuery {
  readonly verifierId?: string;
  readonly expertise: readonly string[];
  readonly limit: number;
  /** Opaque cursor from a previous page. */
  readonly cursor?: string;
  readonly level?: SkillLevel;
  readonly type?: EvidenceType;
  /** Free-text search over the skill name. */
  readonly q?: string;
  /** 'submittedAt' (oldest first, default) or 'submittedAtDesc'. */
  readonly sort?: 'submittedAt' | 'submittedAtDesc';
}

/** FR-004 / NFR-014: one page of the verifier queue plus the filtered total. */
export interface PendingQueuePage {
  readonly items: PendingEvidenceForVerifier[];
  readonly nextCursor: string | null;
  readonly total: number;
}

/**
 * FR-015: the filters an Administrator's cross-domain Verifier queue accepts.
 *
 * This is the same row shape as {@link PendingQueueQuery} but **without** the expertise
 * restriction: an administrator is asking "what work exists in this domain and who, if anyone,
 * has taken it", which the expertise-scoped read cannot answer by construction.
 */
export interface AdminQueueQuery {
  readonly limit: number;
  readonly cursor?: string;
  /** Taxonomy category ("domain" in the SRS). */
  readonly domain?: string;
  /** `pending` = unclaimed; `claimed` = a Verifier has taken it. */
  readonly status?: SkillEvidence['status'];
  /** Free-text search over the skill name. */
  readonly q?: string;
  /** 'submittedAt' (oldest first, default) or 'submittedAtDesc'. */
  readonly sort?: 'submittedAt' | 'submittedAtDesc';
}

/** FR-015 / NFR-014: one page of the admin Verifier queue plus the filtered total. */
export type AdminQueuePage = PendingQueuePage;

export interface ClaimRequest {
  readonly evidenceId: string;
  readonly verifierId: string;
  readonly skillId: string;
  readonly ownerId: string;
  readonly claimedAt: Date;
}

/** FR-004: the claimed evidence plus the context needed to apply/decide it. */
export interface ClaimedEvidence {
  readonly evidence: SkillEvidence;
  readonly skillId: string;
  readonly ownerId: string;
}

export interface ApplyEvidenceDecisionRequest {
  readonly evidenceId: string;
  readonly status: 'approved' | 'rejected';
  readonly reviewerId: string;
  readonly approvedLevel: SkillLevel | null;
  readonly reason: string | null;
  readonly decidedAt: Date;
  readonly skillId: string;
  readonly ownerId: string;
}

export interface ApplyEvidenceDecisionResult {
  /** False when the row was no longer `claimed` (already decided). */
  readonly applied: boolean;
}

export interface SkillEvidenceRepository {
  /** The next version number for a profile-skill (1 when none exist yet). */
  nextVersion(profileSkillId: string): Promise<number>;
  /**
   * Inserts a new `pending` evidence version and writes the
   * `skill.evidence.submitted` outbox event in the **same transaction** (ADR-013).
   */
  create(request: CreateSkillEvidenceRequest): Promise<SkillEvidence>;
  /** All versions for a profile-skill, newest first (owner view; history is FR-018). */
  listByProfileSkill(profileSkillId: string): Promise<SkillEvidence[]>;
  /** The evidence by id, or null. */
  findById(evidenceId: string): Promise<SkillEvidence | null>;
  /**
   * FR-004 / NFR-014: a bounded, filtered, keyset-paged page of the pending requests
   * for skills in the Verifier's expertise set. Only `pending` (unclaimed) requests
   * appear. `total` counts the filtered set (ignoring limit/cursor).
   */
  listPendingForExpertise(query: PendingQueueQuery): Promise<PendingQueuePage>;
  /**
   * FR-015: the **cross-domain** evidence queue for an Administrator (NFR-014).
   *
   * Same rows as {@link listPendingForExpertise} without the expertise restriction, so an
   * administrator can see unclaimed work in a domain no active Verifier covers.
   */
  listForAdmin(query: AdminQueueQuery): Promise<AdminQueuePage>;
  /**
   * FR-004 / BR-071: atomically claims a `pending` request for a Verifier (locks it,
   * no other Verifier may claim or decide). Emits `skill.evidence.claimed`.
   */
  claim(request: ClaimRequest): Promise<ClaimedEvidence>;
  /**
   * FR-004: atomically applies an approve/reject to a **claimed** request, updates the
   * profile-skill cache on approval, supersedes the previous approval, and emits the
   * matching event (BR-013/AC-016).
   */
  decide(request: ApplyEvidenceDecisionRequest): Promise<ApplyEvidenceDecisionResult>;
}

/** FR-004 / ADR-027: a Verifier account with its seeded expertise set. */
export interface VerifierRecord {
  readonly accountId: string;
  readonly status: 'active' | 'suspended' | 'revoked';
  readonly expertise: readonly string[];
}

export interface VerifierRepository {
  /** The Verifier by account id, or null when the account is not a Verifier. */
  findById(accountId: string): Promise<VerifierRecord | null>;
  /** FR-004: an Administrator sets a Verifier's lifecycle status. */
  setStatus(accountId: string, status: 'active' | 'suspended' | 'revoked'): Promise<VerifierRecord | null>;
}

export const EVIDENCE_AUDIT_REPOSITORY = Symbol('EvidenceAuditRepository');

/**
 * FR-018 / ADR-028: append-only evidence history. The writer is called by the
 * repositories that already own the transaction (submit/claim/decide) so the audit
 * row commits with the state change; the reader serves the history endpoint.
 */
export interface EvidenceAuditRepository {
  /** The audit entries for a profile-skill, newest version then newest time first. */
  listByProfileSkill(profileSkillId: string): Promise<EvidenceAuditEntry[]>;
}
