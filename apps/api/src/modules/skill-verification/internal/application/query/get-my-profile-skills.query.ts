import type { ProfileSkillView } from '@skillswap/contracts';
import type { GetMyProfileSkillsPort } from '../port/in/get-my-profile-skills';
import type { ProfileSkillRepository } from '../port/out/skill-evidence-repository';

/**
 * FR-003: the caller's skills with their effective (approved) level. The level is
 * the cached effective approval (ADR-026 §5) — `NULL` until a Verifier approves.
 */
export class GetMyProfileSkillsQueryHandler implements GetMyProfileSkillsPort {
  constructor(private readonly profileSkills: ProfileSkillRepository) {}

  async execute(accountId: string): Promise<ProfileSkillView[]> {
    const rows = await this.profileSkills.listByAccount(accountId);
    return rows.map((row) => ({
      id: row.id,
      skillId: row.skillId,
      skillName: row.skillName,
      category: row.category,
      approvedLevel: row.approvedLevel,
    }));
  }
}
