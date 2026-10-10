import type { SkillEvidenceView } from '@skillswap/contracts';
import { EvidenceNotFoundError, decideEvidence } from '../domain/evidence';
import { SelfDecisionError } from '../domain/verifier';
import type { SkillRepository } from './port/out/skill-repository';
import type {
  ProfileSkillRepository,
  SkillEvidenceRepository,
} from './port/out/skill-evidence-repository';
import type { Clock } from './port/out/clock';
import type { DecideSkillEvidenceCommand, DecideSkillEvidencePort } from './port/in/decide-skill-evidence';
import { VerifierAuthority } from './verifier-authority';
import { toSkillEvidenceView } from './skill-evidence-view';

/** Raised when a request is no longer claimable/decidable (already decided). */
export class EvidenceNotDecidableError extends Error {
  constructor(evidenceId: string) {
    super(`Evidence ${evidenceId} can no longer be decided`);
    this.name = 'EvidenceNotDecidableError';
  }
}

/**
 * FR-004 / API-003: a Verifier approves or rejects a request they hold the claim on.
 * Authority is active + expertise + not-owner (AC-018); the domain enforces that only
 * the claim holder decides. On approval the repository supersedes the previous
 * approval and updates the profile-skill cache atomically (AC-016).
 */
export class DecideSkillEvidenceUseCase implements DecideSkillEvidencePort {
  constructor(
    private readonly evidence: SkillEvidenceRepository,
    private readonly profileSkills: ProfileSkillRepository,
    private readonly skills: SkillRepository,
    private readonly authority: VerifierAuthority,
    private readonly clock: Clock,
  ) {}

  async execute(command: DecideSkillEvidenceCommand): Promise<SkillEvidenceView> {
    const evidence = await this.evidence.findById(command.evidenceId);
    if (evidence === null) {
      throw new EvidenceNotFoundError(command.evidenceId);
    }
    const profileSkill = await this.profileSkills.findById(evidence.profileSkillId);
    if (profileSkill === null) {
      throw new EvidenceNotFoundError(command.evidenceId);
    }

    await this.authority.requireExpertise(command.reviewerId, profileSkill.skillId);
    if (profileSkill.accountId === command.reviewerId) {
      throw new SelfDecisionError(command.reviewerId);
    }

    const decision = decideEvidence(
      {
        status: evidence.status,
        claimedBy: evidence.claimedBy,
        requestedLevel: evidence.requestedLevel,
      },
      {
        decision: command.decision,
        approvedLevel: command.approvedLevel,
        reason: command.reason,
      },
      { reviewerId: command.reviewerId, now: this.clock.now() },
    );

    const result = await this.evidence.decide({
      evidenceId: command.evidenceId,
      status: decision.status,
      reviewerId: decision.reviewerId,
      approvedLevel: decision.approvedLevel,
      reason: decision.reason,
      decidedAt: decision.decidedAt,
      skillId: profileSkill.skillId,
      ownerId: profileSkill.accountId,
    });
    if (!result.applied) {
      throw new EvidenceNotDecidableError(command.evidenceId);
    }

    // AC-016: on approval, cache the effective level on the profile-skill.
    if (decision.status === 'approved') {
      await this.profileSkills.applyApprovedLevel(profileSkill.id, decision.approvedLevel);
    }

    const stored = await this.evidence.findById(command.evidenceId);
    if (stored === null) {
      throw new EvidenceNotFoundError(command.evidenceId);
    }
    const skill = await this.skills.findActiveById(profileSkill.skillId);

    return toSkillEvidenceView(stored, {
      skillId: profileSkill.skillId,
      skillName: skill?.name ?? null,
      category: skill?.category ?? null,
      ownerId: profileSkill.accountId,
    });
  }
}
