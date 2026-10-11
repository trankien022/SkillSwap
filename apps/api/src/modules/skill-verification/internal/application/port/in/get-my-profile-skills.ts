import type { ProfileSkillList, ProfileSkillView } from '@skillswap/contracts';

export const GET_MY_PROFILE_SKILLS = Symbol('GetMyProfileSkills');

/** FR-003 / NFR-014: optional search/sort for the caller's profile skills. */
export interface GetMyProfileSkillsRequest {
  readonly accountId: string;
  readonly q?: string;
  readonly sort?: 'category' | 'name' | '-approvedLevel';
}

/**
 * FR-003: the caller's skills with their effective (approved) level, for the owner view.
 * Bounded by the skill catalogue, so it returns `{ items, page: null }` (no pagination).
 */
export interface GetMyProfileSkillsPort {
  execute(request: GetMyProfileSkillsRequest): Promise<ProfileSkillList>;
}

export type { ProfileSkillView };
