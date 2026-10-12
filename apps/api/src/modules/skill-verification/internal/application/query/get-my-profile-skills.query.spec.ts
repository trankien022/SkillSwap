import { GetMyProfileSkillsQueryHandler } from './get-my-profile-skills.query';
import { InMemoryProfileSkillRepository } from '../testing/skill-evidence-fakes';

describe('GetMyProfileSkillsQueryHandler', () => {
  it("returns the account's skills with their effective level cache (NFR-014)", async () => {
    const repo = new InMemoryProfileSkillRepository();
    await repo.findOrCreate('acc-1', 'sk-1');
    await repo.findOrCreate('acc-1', 'sk-2');
    await repo.findOrCreate('acc-2', 'sk-3');

    const handler = new GetMyProfileSkillsQueryHandler(repo);
    const result = await handler.execute({ accountId: 'acc-1' });

    expect(result.items).toHaveLength(2);
    expect(result.items.every((row) => row.approvedLevel === null)).toBe(true);
    // Bounded by the catalogue → no page metadata.
    expect(result.page).toBeNull();
  });

  it('returns an empty list for an account with no skills', async () => {
    const handler = new GetMyProfileSkillsQueryHandler(new InMemoryProfileSkillRepository());
    expect(await handler.execute({ accountId: 'acc-none' })).toEqual({ items: [], page: null });
  });
});
