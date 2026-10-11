import type { SkillEvidenceView } from '@skillswap/contracts';
import { EvidenceNotFoundError } from '../domain/evidence';
import { SelfDecisionError } from '../domain/verifier';
import type { SkillRepository } from './port/out/skill-repository';
import type {
  ProfileSkillRepository,
  SkillEvidenceRepository,
} from './port/out/skill-evidence-repository';
import type { Clock } from './port/out/clock';
import type { ClaimSkillEvidenceCommand, ClaimSkillEvidencePort } from './port/in/claim-skill-evidence';
import { VerifierAuthority } from './verifier-authority';
import { toSkillEvidenceView } from './skill-evidence-view';

/**
 * FR-004 / ADR-027 / BR-071: a Verifier claims a **pending** request, locking it to
 * them (no release). Enforced here: the account is an active Verifier with expertise
 * for the evidence's skill and is not the owner (AC-018). The repository makes the
 * lock race-safe (only a `pending` row transitions to `claimed`).
 */
export class ClaimSkillEvidenceUseCase implements ClaimSkillEvidencePort {
  private readonly authority: VerifierAuthority;

  constructor(
    private readonly evidence: SkillEvidenceRepository,
    private readonly profileSkills: ProfileSkillRepository,
    private readonly skills: SkillRepository,
    verifiers: VerifierAuthority,
    private readonly clock: Clock,
  ) {
    this.authority = verifiers;
  }

  async execute(command: ClaimSkillEvidenceCommand): Promise<SkillEvidenceView> {
    const evidence = await this.evidence.findById(command.evidenceId);
    if (evidence === null) {
      throw new EvidenceNotFoundError(command.evidenceId);
    }
    const profileSkill = await this.profileSkills.findById(evidence.profileSkillId);
    if (profileSkill === null) {
      throw new EvidenceNotFoundError(command.evidenceId);
    }

    // Active + expertise; the self-owner clause is enforced just below.
    await this.authority.requireExpertise(command.verifierId, profileSkill.skillId);
    if (profileSkill.accountId === command.verifierId) {
      throw new SelfDecisionError(command.verifierId);
    }

    const skill = await this.skills.findActiveById(profileSkill.skillId);
    const claimed = await this.evidence.claim({
      evidenceId: command.evidenceId,
      verifierId: command.verifierId,
      skillId: profileSkill.skillId,
      ownerId: profileSkill.accountId,
      claimedAt: this.clock.now(),
    });

    return toSkillEvidenceView(claimed.evidence, {
      skillId: profileSkill.skillId,
      skillName: skill?.name ?? null,
      category: skill?.category ?? null,
      ownerId: profileSkill.accountId,
    });
  }
}
