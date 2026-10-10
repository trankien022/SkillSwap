/**
 * FR-003 / ADR-026: skill evidence and the skill taxonomy it references.
 *
 * A **verified student** submits evidence for a **known** skill (from the managed
 * `skills` catalogue, a two-level `category → skill` tree) at a **requested level**
 * on the fixed ordered scale. The submission is `pending`; FR-004 decides it (setting
 * `approved_level` and updating the `profile_skills` effective-level cache). A
 * replacement after rejection is a **new version** (history is FR-018); while a
 * replacement is `pending`/`rejected` the previous effective approval is kept
 * (AC-016). Framework-free: no NestJS, no TypeORM.
 */

export const MODULE_NAME = 'skill-verification';

/** FR-003 / ADR-026 §3: the fixed ordered level scale. */
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

/** FR-003 / ADR-026 §2: exact depth of the taxonomy is two levels. */
export const SKILL_LEVEL_ORDER: Readonly<Record<SkillLevel, number>> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

export const EVIDENCE_TYPES = ['certificate', 'verifier_assessment'] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const EVIDENCE_STATUSES = ['pending', 'claimed', 'approved', 'rejected', 'superseded'] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const INITIAL_EVIDENCE_STATUS: EvidenceStatus = 'pending';

/** Statuses an owner (or a Verifier) may still act on. */
export const EFFECTIVE_EVIDENCE_STATUSES = ['pending', 'claimed', 'approved'] as const;
export type EffectiveEvidenceStatus = (typeof EFFECTIVE_EVIDENCE_STATUSES)[number];

/** Statuses a request can still be claimed from: only a fresh `pending` version. */
export const CLAIMABLE_EVIDENCE_STATUSES = ['pending'] as const;
export type ClaimableEvidenceStatus = (typeof CLAIMABLE_EVIDENCE_STATUSES)[number];

export const SKILL_EVIDENCE_EVENTS = {
  submitted: 'skill.evidence.submitted',
  claimed: 'skill.evidence.claimed',
  approved: 'skill.evidence.approved',
  rejected: 'skill.evidence.rejected',
} as const;

// --- Errors ----------------------------------------------------------------

export class UnknownSkillError extends Error {
  constructor(skillId: string) {
    super(`Unknown skill: ${skillId}`);
    this.name = 'UnknownSkillError';
  }
}

export class InvalidLevelError extends Error {
  constructor(level: string) {
    super(`Invalid skill level: ${level}`);
    this.name = 'InvalidLevelError';
  }
}

export class InvalidEvidenceTypeError extends Error {
  constructor(type: string) {
    super(`Invalid evidence type: ${type}`);
    this.name = 'InvalidEvidenceTypeError';
  }
}

export class UnknownEvidenceStatusError extends Error {
  constructor(status: string) {
    super(`Unknown evidence status: ${status}`);
    this.name = 'UnknownEvidenceStatusError';
  }
}

export class NotVerifiedStudentError extends Error {
  constructor(accountId: string) {
    super(`Account ${accountId} is not a verified student`);
    this.name = 'NotVerifiedStudentError';
  }
}

export class EvidenceDocumentRequiredError extends Error {
  constructor(type: EvidenceType) {
    super(`A ${type} evidence submission requires a document`);
    this.name = 'EvidenceDocumentRequiredError';
  }
}

/** FR-004: a rejection requires a non-empty reason. */
export class ReasonRequiredError extends Error {
  constructor(action = 'rejection') {
    super(`A ${action} requires a non-empty reason`);
    this.name = 'ReasonRequiredError';
  }
}

/** FR-004: the referenced evidence version does not exist. */
export class EvidenceNotFoundError extends Error {
  constructor(evidenceId: string) {
    super(`Skill evidence not found: ${evidenceId}`);
    this.name = 'EvidenceNotFoundError';
  }
}

// --- Guards ----------------------------------------------------------------

export function isSkillLevel(value: string): value is SkillLevel {
  return (SKILL_LEVELS as readonly string[]).includes(value);
}

export function assertSkillLevel(value: string): asserts value is SkillLevel {
  if (!isSkillLevel(value)) {
    throw new InvalidLevelError(value);
  }
}

export function isEvidenceType(value: string): value is EvidenceType {
  return (EVIDENCE_TYPES as readonly string[]).includes(value);
}

export function assertEvidenceType(value: string): asserts value is EvidenceType {
  if (!isEvidenceType(value)) {
    throw new InvalidEvidenceTypeError(value);
  }
}

export function isEvidenceStatus(value: string): value is EvidenceStatus {
  return (EVIDENCE_STATUSES as readonly string[]).includes(value);
}

export function assertEvidenceStatus(value: string): asserts value is EvidenceStatus {
  if (!isEvidenceStatus(value)) {
    throw new UnknownEvidenceStatusError(value);
  }
}

/**
 * FR-005 / AC-016: whether an approved level **covers** a required level, i.e. the
 * approved level is at least the required one on the ordered scale.
 */
export function levelCovers(approved: SkillLevel, required: SkillLevel): boolean {
  return SKILL_LEVEL_ORDER[approved] >= SKILL_LEVEL_ORDER[required];
}

// --- Skill (taxonomy) ------------------------------------------------------

/**
 * FR-003 / ADR-026 §1–2: a catalogue entry. `category` is the single parent level
 * of the two-level tree; skills are admin-seeded and evidence must reference one.
 */
export interface Skill {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly active: boolean;
}

// --- ProfileSkill (effective-level cache) ----------------------------------

/**
 * FR-003 / ADR-026 §5: the link between a profile and a skill. `approvedLevel`
 * **caches the effective approval** and is `NULL` until a Verifier approves the
 * evidence (FR-004). Resubmission must not clear a prior effective approval (AC-016).
 */
export class ProfileSkill {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly skillId: string,
    readonly approvedLevel: SkillLevel | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(input: {
    id: string;
    accountId: string;
    skillId: string;
    createdAt: Date;
  }): ProfileSkill {
    return new ProfileSkill(input.id, input.accountId, input.skillId, null, input.createdAt, input.createdAt);
  }

  static reconstitute(input: {
    id: string;
    accountId: string;
    skillId: string;
    approvedLevel: SkillLevel | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProfileSkill {
    if (input.approvedLevel !== null) {
      assertSkillLevel(input.approvedLevel);
    }
    return new ProfileSkill(
      input.id,
      input.accountId,
      input.skillId,
      input.approvedLevel,
      input.createdAt,
      input.updatedAt,
    );
  }

  get hasApproval(): boolean {
    return this.approvedLevel !== null;
  }
}

// --- SkillEvidence (versioned submission) ----------------------------------

export interface SkillEvidenceSnapshot {
  readonly id: string;
  readonly profileSkillId: string;
  readonly evidenceType: EvidenceType;
  readonly documentRef: string | null;
  readonly description: string | null;
  readonly version: number;
  readonly requestedLevel: SkillLevel;
  readonly approvedLevel: SkillLevel | null;
  readonly status: EvidenceStatus;
  readonly claimedBy: string | null;
  readonly claimedAt: Date | null;
  readonly reviewerId: string | null;
  readonly reason: string | null;
  readonly decidedAt: Date | null;
  readonly submittedAt: Date;
}

export class SkillEvidence {
  private constructor(
    readonly id: string,
    readonly profileSkillId: string,
    readonly evidenceType: EvidenceType,
    readonly documentRef: string | null,
    readonly description: string | null,
    readonly version: number,
    readonly requestedLevel: SkillLevel,
    readonly approvedLevel: SkillLevel | null,
    readonly status: EvidenceStatus,
    readonly claimedBy: string | null,
    readonly claimedAt: Date | null,
    readonly reviewerId: string | null,
    readonly reason: string | null,
    readonly decidedAt: Date | null,
    readonly submittedAt: Date,
  ) {}

  /**
   * FR-003: submits a new evidence version. A `certificate` must carry a document;
   * a `verifier_assessment` may rely on the description. The version is assigned by
   * the caller (the next number for this profile-skill).
   */
  static submit(input: {
    id: string;
    profileSkillId: string;
    evidenceType: EvidenceType;
    documentRef?: string | null;
    description?: string | null;
    version: number;
    requestedLevel: SkillLevel;
    submittedAt: Date;
  }): SkillEvidence {
    assertEvidenceType(input.evidenceType);
    assertSkillLevel(input.requestedLevel);
    if (input.version < 1 || !Number.isInteger(input.version)) {
      throw new RangeError('version must be a positive integer');
    }
    const documentRef = input.documentRef?.trim() || null;
    const description = input.description?.trim() || null;
    if (input.evidenceType === 'certificate' && documentRef === null) {
      throw new EvidenceDocumentRequiredError('certificate');
    }
    if (documentRef === null && description === null) {
      throw new EvidenceDocumentRequiredError(input.evidenceType);
    }
    return new SkillEvidence(
      input.id,
      input.profileSkillId,
      input.evidenceType,
      documentRef,
      description,
      input.version,
      input.requestedLevel,
      null,
      INITIAL_EVIDENCE_STATUS,
      null,
      null,
      null,
      null,
      null,
      input.submittedAt,
    );
  }

  static reconstitute(snapshot: SkillEvidenceSnapshot): SkillEvidence {
    assertEvidenceType(snapshot.evidenceType);
    assertSkillLevel(snapshot.requestedLevel);
    assertEvidenceStatus(snapshot.status);
    if (snapshot.approvedLevel !== null) {
      assertSkillLevel(snapshot.approvedLevel);
    }
    return new SkillEvidence(
      snapshot.id,
      snapshot.profileSkillId,
      snapshot.evidenceType,
      snapshot.documentRef,
      snapshot.description,
      snapshot.version,
      snapshot.requestedLevel,
      snapshot.approvedLevel,
      snapshot.status,
      snapshot.claimedBy,
      snapshot.claimedAt,
      snapshot.reviewerId,
      snapshot.reason,
      snapshot.decidedAt,
      snapshot.submittedAt,
    );
  }

  /** A version the owner/Verifier may still act on (only `pending`). */
  get isPending(): boolean {
    return this.status === 'pending';
  }

  /** FR-004: a fresh request no Verifier has claimed yet. */
  get isClaimable(): boolean {
    return this.status === 'pending';
  }

  /** FR-004: this request is locked to a Verifier (`claimed`). */
  get isClaimed(): boolean {
    return this.status === 'claimed';
  }
}

// --- FR-004: verifier authority, claim and decision ------------------------

export function isClaimableStatus(status: EvidenceStatus): status is ClaimableEvidenceStatus {
  return (CLAIMABLE_EVIDENCE_STATUSES as readonly string[]).includes(status);
}

export class EvidenceNotClaimableError extends Error {
  constructor(status: EvidenceStatus) {
    super(`Evidence with status ${status} cannot be claimed`);
    this.name = 'EvidenceNotClaimableError';
  }
}

export class EvidenceNotClaimedError extends Error {
  constructor(status: EvidenceStatus) {
    super(`Evidence with status ${status} is not claimed by any Verifier`);
    this.name = 'EvidenceNotClaimedError';
  }
}

export class NotClaimOwnerError extends Error {
  constructor(verifierId: string) {
    super(`Verifier ${verifierId} does not hold the claim on this evidence`);
    this.name = 'NotClaimOwnerError';
  }
}

export interface EvidenceClaim {
  status: 'claimed';
  claimedBy: string;
  claimedAt: Date;
}

/**
 * FR-004 / BR-071: a Verifier claims a **pending** request, locking it to them.
 * Only a `pending` request is claimable; a `claimed` or decided one is refused.
 * The caller has already checked the Verifier's expertise matches the evidence skill.
 */
export function claimEvidence(
  status: EvidenceStatus,
  verifierId: string,
  now: Date,
): EvidenceClaim {
  if (!isClaimableStatus(status)) {
    throw new EvidenceNotClaimableError(status);
  }
  return { status: 'claimed', claimedBy: verifierId, claimedAt: now };
}

export interface EvidenceDecision {
  status: 'approved' | 'rejected';
  reviewerId: string;
  approvedLevel: SkillLevel | null;
  reason: string | null;
  decidedAt: Date;
}

/**
 * FR-004 / BR-013, BR-014, AC-018: applies a Verifier decision to a **claimed**
 * request. Only the Verifier who holds the claim may decide. `approve` may set an
 * `approvedLevel` (defaulting to the requested level); `reject` requires a reason.
 */
export function decideEvidence(
  evidence: { status: EvidenceStatus; claimedBy: string | null; requestedLevel: SkillLevel },
  decision: { decision: 'approve' | 'reject'; approvedLevel?: SkillLevel; reason?: string },
  context: { reviewerId: string; now: Date },
): EvidenceDecision {
  if (evidence.status !== 'claimed' || evidence.claimedBy === null) {
    throw new EvidenceNotClaimedError(evidence.status);
  }
  if (evidence.claimedBy !== context.reviewerId) {
    throw new NotClaimOwnerError(context.reviewerId);
  }

  if (decision.decision === 'reject') {
    const reason = decision.reason?.trim();
    if (!reason) {
      throw new ReasonRequiredError();
    }
    return {
      status: 'rejected',
      reviewerId: context.reviewerId,
      approvedLevel: null,
      reason,
      decidedAt: context.now,
    };
  }

  const approvedLevel = decision.approvedLevel ?? evidence.requestedLevel;
  assertSkillLevel(approvedLevel);
  return {
    status: 'approved',
    reviewerId: context.reviewerId,
    approvedLevel,
    reason: null,
    decidedAt: context.now,
  };
}

/**
 * FR-003 / AC-016: the **effective** (still-usable) approval for a profile-skill.
 * A new submission never clears it; only an approval of the replacement supersedes
 * the previous one atomically (that transition is FR-004's decision). Among a
 * profile-skill's versions, the effective approval is the most recent `approved`
 * version that has **not** been superseded.
 */
export function effectiveApprovedLevel(
  evidence: readonly SkillEvidenceSnapshot[],
): SkillLevel | null {
  let best: SkillLevel | null = null;
  for (const snapshot of evidence) {
    if (snapshot.status === 'approved' && snapshot.approvedLevel !== null) {
      best = snapshot.approvedLevel;
    }
  }
  return best;
}
