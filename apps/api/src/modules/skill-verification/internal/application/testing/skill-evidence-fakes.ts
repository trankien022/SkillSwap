import {
  EvidenceNotClaimableError,
  ProfileSkill,
  SkillEvidence,
  type Skill,
  type SkillLevel,
} from '../../domain/evidence';
import type { Clock } from '../port/out/clock';
import type { SkillRepository } from '../port/out/skill-repository';
import type {
  ApplyEvidenceDecisionRequest,
  ApplyEvidenceDecisionResult,
  ClaimRequest,
  ClaimedEvidence,
  CreateSkillEvidenceRequest,
  PendingEvidenceForVerifier,
  ProfileSkillRepository,
  ProfileSkillWithSkill,
  SkillEvidenceRepository,
  VerifierRecord,
  VerifierRepository,
} from '../port/out/skill-evidence-repository';
import type { VerifiedStudentReader } from '../port/out/verified-student-reader';

export function fixedClock(now: Date): Clock {
  return { now: () => now };
}

/** In-memory catalogue for use-case specs. */
export class InMemorySkillRepository implements SkillRepository {
  constructor(private readonly skills: Skill[] = []) {}

  async findActiveById(skillId: string): Promise<Skill | null> {
    return this.skills.find((skill) => skill.id === skillId && skill.active) ?? null;
  }
}

/** Reconstructs an evidence row with overrides (mirrors the SQL adapter's writes). */
function withEvidence(
  current: SkillEvidence,
  over: Partial<{
    status: SkillEvidence['status'];
    claimedBy: string | null;
    claimedAt: Date | null;
    reviewerId: string | null;
    approvedLevel: SkillLevel | null;
    reason: string | null;
    decidedAt: Date | null;
  }>,
): SkillEvidence {
  return SkillEvidence.reconstitute({
    id: current.id,
    profileSkillId: current.profileSkillId,
    evidenceType: current.evidenceType,
    documentRef: current.documentRef,
    description: current.description,
    version: current.version,
    requestedLevel: current.requestedLevel,
    approvedLevel: over.approvedLevel ?? current.approvedLevel,
    status: over.status ?? current.status,
    claimedBy: over.claimedBy ?? current.claimedBy,
    claimedAt: over.claimedAt ?? current.claimedAt,
    reviewerId: over.reviewerId ?? current.reviewerId,
    reason: over.reason ?? current.reason,
    decidedAt: over.decidedAt ?? current.decidedAt,
    submittedAt: current.submittedAt,
  });
}

/** In-memory ProfileSkillRepository; ids are assigned incrementally. */
export class InMemoryProfileSkillRepository implements ProfileSkillRepository {
  readonly rows: ProfileSkill[] = [];
  private seq = 0;

  async findByAccountAndSkill(accountId: string, skillId: string): Promise<ProfileSkill | null> {
    return (
      this.rows.find((row) => row.accountId === accountId && row.skillId === skillId) ?? null
    );
  }

  async findById(profileSkillId: string): Promise<ProfileSkill | null> {
    return this.rows.find((row) => row.id === profileSkillId) ?? null;
  }

  async listByAccount(accountId: string): Promise<ProfileSkillWithSkill[]> {
    return this.rows
      .filter((row) => row.accountId === accountId)
      .map((row) => ({
        id: row.id,
        skillId: row.skillId,
        skillName: row.skillId,
        category: 'unknown',
        approvedLevel: row.approvedLevel,
      }));
  }

  async findOrCreate(accountId: string, skillId: string): Promise<ProfileSkill> {
    const existing = await this.findByAccountAndSkill(accountId, skillId);
    if (existing !== null) {
      return existing;
    }
    const link = ProfileSkill.create({
      id: `ps-${++this.seq}`,
      accountId,
      skillId,
      createdAt: new Date('2026-10-11T00:00:00.000Z'),
    });
    this.rows.push(link);
    return link;
  }

  async applyApprovedLevel(profileSkillId: string, level: SkillLevel | null): Promise<void> {
    const index = this.rows.findIndex((row) => row.id === profileSkillId);
    if (index === -1) {
      return;
    }
    const current = this.rows[index];
    this.rows[index] = ProfileSkill.reconstitute({
      id: current.id,
      accountId: current.accountId,
      skillId: current.skillId,
      approvedLevel: level,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
    });
  }
}

/** In-memory SkillEvidenceRepository; assigns versions per profile-skill. */
export class InMemorySkillEvidenceRepository implements SkillEvidenceRepository {
  readonly rows: SkillEvidence[] = [];

  /** Test seam: register a skill/owner for a profile-skill (for queue/claim specs). */
  readonly profileSkillContext = new Map<string, { skillId: string; ownerId: string }>();

  async nextVersion(profileSkillId: string): Promise<number> {
    const versions = this.rows
      .filter((row) => row.profileSkillId === profileSkillId)
      .map((row) => row.version);
    return versions.length === 0 ? 1 : Math.max(...versions) + 1;
  }

  async create(request: CreateSkillEvidenceRequest): Promise<SkillEvidence> {
    const evidence = SkillEvidence.submit({
      id: request.id,
      profileSkillId: request.profileSkillId,
      evidenceType: request.evidenceType,
      documentRef: request.documentRef,
      description: request.description,
      version: await this.nextVersion(request.profileSkillId),
      requestedLevel: request.requestedLevel,
      submittedAt: request.submittedAt,
    });
    this.rows.push(evidence);
    this.profileSkillContext.set(request.profileSkillId, {
      skillId: request.skillId,
      ownerId: request.accountId,
    });
    return evidence;
  }

  async listByProfileSkill(profileSkillId: string): Promise<SkillEvidence[]> {
    return this.rows
      .filter((row) => row.profileSkillId === profileSkillId)
      .sort((a, b) => b.version - a.version);
  }

  async findById(evidenceId: string): Promise<SkillEvidence | null> {
    return this.rows.find((row) => row.id === evidenceId) ?? null;
  }

  async listPendingForExpertise(expertise: readonly string[]): Promise<PendingEvidenceForVerifier[]> {
    return this.rows
      .filter((row) => row.status === 'pending')
      .filter((row) => {
        const ctx = this.profileSkillContext.get(row.profileSkillId);
        return ctx !== undefined && expertise.includes(ctx.skillId);
      })
      .map((row) => {
        const ctx = this.profileSkillContext.get(row.profileSkillId)!;
        return {
          id: row.id,
          profileSkillId: row.profileSkillId,
          skillId: ctx.skillId,
          skillName: ctx.skillId,
          category: 'unknown',
          ownerId: ctx.ownerId,
          evidence: row,
        };
      });
  }

  async claim(request: ClaimRequest): Promise<ClaimedEvidence> {
    const index = this.rows.findIndex((row) => row.id === request.evidenceId && row.status === 'pending');
    if (index === -1) {
      throw new EvidenceNotClaimableError('claimed');
    }
    const claimed = withEvidence(this.rows[index], {
      status: 'claimed',
      claimedBy: request.verifierId,
      claimedAt: request.claimedAt,
    });
    this.rows[index] = claimed;
    return { evidence: claimed, skillId: request.skillId, ownerId: request.ownerId };
  }

  async decide(request: ApplyEvidenceDecisionRequest): Promise<ApplyEvidenceDecisionResult> {
    const index = this.rows.findIndex(
      (row) => row.id === request.evidenceId && row.status === 'claimed' && row.claimedBy === request.reviewerId,
    );
    if (index === -1) {
      return { applied: false };
    }
    const current = this.rows[index];
    if (request.status === 'approved') {
      this.rows.forEach((row, i) => {
        if (row.profileSkillId === current.profileSkillId && row.status === 'approved') {
          this.rows[i] = withEvidence(row, { status: 'superseded' });
        }
      });
    }
    this.rows[index] = withEvidence(current, {
      status: request.status,
      reviewerId: request.reviewerId,
      approvedLevel: request.approvedLevel,
      reason: request.reason,
      decidedAt: request.decidedAt,
    });
    return { applied: true };
  }
}

/** In-memory VerifierRepository. */
export class InMemoryVerifierRepository implements VerifierRepository {
  constructor(private readonly rows: VerifierRecord[] = []) {}

  async findById(accountId: string): Promise<VerifierRecord | null> {
    return this.rows.find((row) => row.accountId === accountId) ?? null;
  }

  async setStatus(
    accountId: string,
    status: 'active' | 'suspended' | 'revoked',
  ): Promise<VerifierRecord | null> {
    const index = this.rows.findIndex((row) => row.accountId === accountId);
    if (index === -1) {
      return null;
    }
    this.rows[index] = { ...this.rows[index], status };
    return this.rows[index];
  }
}

/** In-memory VerifiedStudentReader keyed by account id. */
export class InMemoryVerifiedStudentReader implements VerifiedStudentReader {
  constructor(private readonly verified: ReadonlySet<string> = new Set()) {}

  async isVerifiedStudent(accountId: string): Promise<boolean> {
    return this.verified.has(accountId);
  }
}

export function skillFixture(over: Partial<Skill> = {}): Skill {
  return { id: 'sk-1', name: 'IELTS', category: 'Languages', active: true, ...over };
}

export const LEVEL: SkillLevel = 'intermediate';
