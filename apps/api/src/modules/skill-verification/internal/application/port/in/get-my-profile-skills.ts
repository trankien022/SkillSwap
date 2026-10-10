import type { ProfileSkillView } from '@skillswap/contracts';

export const GET_MY_PROFILE_SKILLS = Symbol('GetMyProfileSkills');

/** FR-003: the caller's skills with their effective (approved) level, for the owner view. */
export interface GetMyProfileSkillsPort {
  execute(accountId: string): Promise<ProfileSkillView[]>;
}
