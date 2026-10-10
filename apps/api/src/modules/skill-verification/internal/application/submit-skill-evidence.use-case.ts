import { randomUUID } from 'node:crypto';
import type { SkillEvidenceView } from '@skillswap/contracts';
import {
  NotVerifiedStudentError,
  SkillEvidence,
  UnknownSkillError,
} from '../domain/evidence';
import type { Clock } from './port/out/clock';
import type { SkillRepository } from './port/out/skill-repository';
import type {
  ProfileSkillRepository,
  SkillEvidenceRepository,
} from './port/out/skill-evidence-repository';
import type { VerifiedStudentReader } from './port/out/verified-student-reader';
import type {
  SubmitSkillEvidenceCommand,
  SubmitSkillEvidencePort,
} from './port/in/submit-skill-evidence';
import { toSkillEvidenceView } from './skill-evidence-view';

/**
 * FR-003 / API-002: a **verified student** submits evidence for a **known** skill at
 * a requested level. The account's verified-student state is read from this module's
 * ADR-024 projection (no cross-schema read); the skill must exist in the catalogue
 * (ADR-026). The submission joins or creates the account↔skill link and stores a new
 * `pending` version; a replacement **keeps any prior effective approval** (AC-016) —
 * the link's cached level is untouched here, only FR-004's approval changes it.
 */
export class SubmitSkillEvidenceUseCase implements SubmitSkillEvidencePort {
  constructor(
    private readonly skills: SkillRepository,
    private readonly profileSkills: ProfileSkillRepository,
    private readonly evidence: SkillEvidenceRepository,
    private readonly verifiedStudents: VerifiedStudentReader,
    private readonly clock: Clock,
  ) {}

  async execute(command: SubmitSkillEvidenceCommand): Promise<SkillEvidenceView> {
    if (!(await this.verifiedStudents.isVerifiedStudent(command.accountId))) {
      throw new NotVerifiedStudentError(command.accountId);
    }

    const skill = await this.skills.findActiveById(command.skillId);
    if (skill === null) {
      throw new UnknownSkillError(command.skillId);
    }

    const link = await this.profileSkills.findOrCreate(command.accountId, skill.id);

    const draft = SkillEvidence.submit({
      id: randomUUID(),
      profileSkillId: link.id,
      evidenceType: command.evidenceType,
      documentRef: command.documentRef ?? null,
      description: command.description ?? null,
      version: await this.evidence.nextVersion(link.id),
      requestedLevel: command.requestedLevel,
      submittedAt: this.clock.now(),
    });

    const stored = await this.evidence.create({
      id: draft.id,
      profileSkillId: draft.profileSkillId,
      evidenceType: draft.evidenceType,
      documentRef: draft.documentRef,
      description: draft.description,
      requestedLevel: draft.requestedLevel,
      accountId: command.accountId,
      skillId: skill.id,
      submittedAt: draft.submittedAt,
    });

    return toSkillEvidenceView(stored, skill.id);
  }
}
