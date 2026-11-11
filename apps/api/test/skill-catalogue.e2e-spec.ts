import { randomUUID } from 'node:crypto';
import {
  SKILL_CATALOGUE_SUMMARY_READER,
  type SkillCatalogueSummaryReader,
} from '../src/modules/skill-verification/api';
import { startHarness, type Harness } from './harness';

jest.setTimeout(60_000);

/** Real PostgreSQL UUID lookups: query mocks cannot catch uuid = text errors. */
describe('E2E: public skill catalogue summaries (FR-006)', () => {
  let harness: Harness;
  let reader: SkillCatalogueSummaryReader;
  const activeId = randomUUID();
  const inactiveId = randomUUID();

  beforeAll(async () => {
    harness = await startHarness();
    reader = harness.resolve<SkillCatalogueSummaryReader>(SKILL_CATALOGUE_SUMMARY_READER);
    await harness.query('skill-verification',
      `INSERT INTO skills (id, name, category, active) VALUES
       ($1, 'UUID lookup active', 'Regression', true),
       ($2, 'UUID lookup inactive', 'Regression', false)`,
      [activeId, inactiveId],
    );
  });

  afterAll(async () => {
    if (harness) {
      try {
        await harness.query('skill-verification',
          'DELETE FROM skills WHERE id::text = ANY($1::text[])',
          [[activeId, inactiveId]],
        );
      } finally {
        await harness.close();
      }
    }
  });

  it('resolves UUID ids, removes duplicates and excludes inactive or unknown ids', async () => {
    await expect(reader.readMany([activeId, activeId, inactiveId, randomUUID(), 'unknown-skill']))
      .resolves.toEqual([{
        id: activeId,
        name: 'UUID lookup active',
        category: 'Regression',
        levels: ['beginner', 'intermediate', 'advanced', 'expert'],
      }]);
  });

  it('returns an empty summary for an empty request', async () => {
    await expect(reader.readMany([])).resolves.toEqual([]);
  });
});
