import type {
  EvidenceVersionHistoryView,
  SkillEvidenceHistoryView,
} from '@skillswap/contracts';
import { EvidenceNotFoundError } from '../domain/evidence';
import type { EvidenceAuditEntry } from '../domain/history';
import { AccessDeniedError } from '../domain/access';
import type {
  EvidenceAuditRepository,
  ProfileSkillRepository,
  SkillEvidenceRepository,
} from './port/out/skill-evidence-repository';
import type {
  GetSkillEvidenceHistoryCommand,
  GetSkillEvidenceHistoryPort,
} from './port/in/get-skill-evidence-history';

/**
 * FR-018 / ADR-028: returns every evidence version of a profile-skill with its
 * ordered audit trail. Readable by the **owner**, the **reviewing Verifier**, or an
 * **Administrator**; anyone else is refused (no cross-account disclosure).
 */
export class GetSkillEvidenceHistoryUseCase implements GetSkillEvidenceHistoryPort {
  constructor(
    private readonly evidence: SkillEvidenceRepository,
    private readonly profileSkills: ProfileSkillRepository,
    private readonly audit: EvidenceAuditRepository,
  ) {}

  async execute(command: GetSkillEvidenceHistoryCommand): Promise<SkillEvidenceHistoryView> {
    const target = await this.evidence.findById(command.evidenceId);
    if (target === null) {
      throw new EvidenceNotFoundError(command.evidenceId);
    }
    const profileSkill = await this.profileSkills.findById(target.profileSkillId);
    if (profileSkill === null) {
      throw new EvidenceNotFoundError(command.evidenceId);
    }

    const versions = await this.evidence.listByProfileSkill(profileSkill.id);
    const isOwner = profileSkill.accountId === command.viewerId;
    const isAdmin = command.viewerRole === 'admin';
    const isReviewer = versions.some(
      (v) => v.reviewerId === command.viewerId || v.claimedBy === command.viewerId,
    );
    if (!isOwner && !isAdmin && !isReviewer) {
      throw new AccessDeniedError(command.viewerId);
    }

    const entries = await this.audit.listByProfileSkill(profileSkill.id);
    const byVersion = new Map<number, EvidenceAuditEntry[]>();
    for (const entry of entries) {
      const list = byVersion.get(entry.version) ?? [];
      list.push(entry);
      byVersion.set(entry.version, list);
    }

    const history: EvidenceVersionHistoryView[] = versions.map((version) => ({      version: version.version,
      evidenceId: version.id,
      currentStatus: version.status,
      requestedLevel: version.requestedLevel,
      approvedLevel: version.approvedLevel,
      submittedAt: version.submittedAt.toISOString(),
      entries: (byVersion.get(version.version) ?? []).map((entry) => ({
        id: entry.id,
        evidenceId: entry.evidenceId,
        version: entry.version,
        action: entry.action,
        actorId: entry.actorId,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        reason: entry.reason,
        snapshot: entry.snapshot,
        occurredAt: entry.occurredAt.toISOString(),
        traceId: entry.traceId,
      })),
    }));

    return {
      profileSkillId: profileSkill.id,
      skillId: profileSkill.skillId,
      versions: history,
    };
  }
}
