import type { ProfileSkillList, ProfileSkillView } from '@skillswap/contracts';
import type {
  GetMyProfileSkillsPort,
  GetMyProfileSkillsRequest,
} from '../port/in/get-my-profile-skills';
import type { ProfileSkillRepository } from '../port/out/skill-evidence-repository';

/**
 * FR-003: the caller's skills with their effective (approved) level. The level is
 * the cached effective approval (ADR-026 §5) — `NULL` until a Verifier approves.
 *
 * NFR-014: the result is bounded by the managed skill catalogue (an account links at
 * most one row per catalogue skill), so it is not paginated; the caller may filter by
 * skill name (`q`) and choose the sort order.
 */
export class GetMyProfileSkillsQueryHandler implements GetMyProfileSkillsPort {
  constructor(private readonly profileSkills: ProfileSkillRepository) {}

  async execute(request: GetMyProfileSkillsRequest): Promise<ProfileSkillList> {
    const rows = await this.profileSkills.listByAccount(request.accountId, {
      q: request.q,
      sort: request.sort,
    });
    const items: ProfileSkillView[] = rows.map((row) => ({
      id: row.id,
      skillId: row.skillId,
      skillName: row.skillName,
      category: row.category,
      approvedLevel: row.approvedLevel,
    }));
    return { items, page: null };
  }
}
