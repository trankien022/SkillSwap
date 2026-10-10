import { GetMyProfileSkillsQueryHandler } from './get-my-profile-skills.query';
import { InMemoryProfileSkillRepository } from '../testing/skill-evidence-fakes';

describe('GetMyProfileSkillsQueryHandler', () => {
  it("returns the account's skills with their effective level cache", async () => {
    const repo = new InMemoryProfileSkillRepository();
    await repo.findOrCreate('acc-1', 'sk-1');
    await repo.findOrCreate('acc-1', 'sk-2');
    await repo.findOrCreate('acc-2', 'sk-3');

    const handler = new GetMyProfileSkillsQueryHandler(repo);
    const rows = await handler.execute('acc-1');

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.approvedLevel === null)).toBe(true);
  });

  it('returns an empty list for an account with no skills', async () => {
    const handler = new GetMyProfileSkillsQueryHandler(new InMemoryProfileSkillRepository());
    expect(await handler.execute('acc-none')).toEqual([]);
  });
});
