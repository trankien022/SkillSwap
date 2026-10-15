import { DEFAULT_PAGE_LIMIT, type SkillLevel, type EvidenceType } from '@skillswap/contracts';
import { ListAdminVerifierQueueQueryHandler } from './list-admin-verifier-queue.query';
import { InMemorySkillEvidenceRepository } from './testing/skill-evidence-fakes';

/**
 * FR-015 / NFR-014: the admin Verifier queue handler.
 *
 * What matters here is that the handler is genuinely cross-domain — it never consults a Verifier
 * account, so work in a domain with no active Verifier is still visible — and that it maps rows
 * through the same view the Verifier's own queue uses.
 */

const AT = (day: number): Date => new Date(`2026-10-${String(day).padStart(2, '0')}T00:00:00.000Z`);

interface Seed {
  readonly id: string;
  readonly profileSkillId: string;
  readonly skillId: string;
  readonly category: string;
  readonly skillName?: string;
  readonly ownerId?: string;
  readonly status?: 'pending' | 'claimed' | 'approved' | 'rejected' | 'superseded';
  readonly submittedAt: Date;
}

async function seed(
  repository: InMemorySkillEvidenceRepository,
  rows: readonly Seed[],
): Promise<void> {
  for (const row of rows) {
    repository.skillDomains.set(row.skillId, row.category);
    repository.skillNames.set(row.skillId, row.skillName ?? row.skillId);
    const evidence = await repository.create({
      id: row.id,
      profileSkillId: row.profileSkillId,
      evidenceType: 'certificate' as EvidenceType,
      documentRef: `doc-${row.id}`,
      description: null,
      requestedLevel: 'intermediate' as SkillLevel,
      accountId: row.ownerId ?? 'acc-1',
      skillId: row.skillId,
      submittedAt: row.submittedAt,
    });
    if (row.status === 'claimed') {
      await repository.claim({
        evidenceId: evidence.id,
        verifierId: 'vf-1',
        skillId: row.skillId,
        ownerId: row.ownerId ?? 'acc-1',
        claimedAt: row.submittedAt,
      });
    }
  }
}

describe('ListAdminVerifierQueueQueryHandler', () => {
  it('applies the default page limit when none is given', async () => {
    const repository = new InMemorySkillEvidenceRepository();
    const handler = new ListAdminVerifierQueueQueryHandler(repository);

    const page = await handler.execute({});

    expect(page.page.limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(page.page.nextCursor).toBeNull();
  });

  it('shows work in a domain with no Verifier at all', async () => {
    const repository = new InMemorySkillEvidenceRepository();
    await seed(repository, [
      {
        id: 'e-1',
        profileSkillId: 'ps-1',
        skillId: 'sk-1',
        category: 'Painting',
        skillName: 'Oil painting',
        submittedAt: AT(1),
      },
    ]);
    const handler = new ListAdminVerifierQueueQueryHandler(repository);

    const page = await handler.execute({});

    // No verifier account was ever consulted, so the orphaned domain is still listed.
    expect(page.items.map((item) => item.id)).toEqual(['e-1']);
    expect(page.page.total).toBe(1);
  });

  it('maps rows with their taxonomy context', async () => {
    const repository = new InMemorySkillEvidenceRepository();
    await seed(repository, [
      {
        id: 'e-1',
        profileSkillId: 'ps-1',
        skillId: 'sk-1',
        category: 'Programming',
        skillName: 'TypeScript',
        ownerId: 'acc-9',
        submittedAt: AT(1),
      },
    ]);
    const handler = new ListAdminVerifierQueueQueryHandler(repository);

    const page = await handler.execute({});

    expect(page.items[0]).toMatchObject({
      id: 'e-1',
      skillId: 'sk-1',
      skillName: 'TypeScript',
      category: 'Programming',
      ownerId: 'acc-9',
    });
  });

  it('filters by domain', async () => {
    const repository = new InMemorySkillEvidenceRepository();
    await seed(repository, [
      {
        id: 'e-1', profileSkillId: 'ps-1', skillId: 'sk-1',
        category: 'Programming', submittedAt: AT(1),
      },
      {
        id: 'e-2', profileSkillId: 'ps-2', skillId: 'sk-2',
        category: 'Languages', submittedAt: AT(2),
      },
    ]);
    const handler = new ListAdminVerifierQueueQueryHandler(repository);

    const page = await handler.execute({ domain: 'Languages' });

    expect(page.items.map((item) => item.id)).toEqual(['e-2']);
    expect(page.page.total).toBe(1);
  });

  it('filters by status so in-review work can be separated from unclaimed work', async () => {
    const repository = new InMemorySkillEvidenceRepository();
    await seed(repository, [
      {
        id: 'e-1', profileSkillId: 'ps-1', skillId: 'sk-1',
        category: 'Programming', status: 'pending', submittedAt: AT(1),
      },
      {
        id: 'e-2', profileSkillId: 'ps-2', skillId: 'sk-2',
        category: 'Programming', status: 'claimed', submittedAt: AT(2),
      },
    ]);
    const handler = new ListAdminVerifierQueueQueryHandler(repository);

    const unclaimed = await handler.execute({ status: ['pending'] });
    const inReview = await handler.execute({ status: ['claimed'] });

    expect(unclaimed.items.map((item) => item.id)).toEqual(['e-1']);
    expect(inReview.items.map((item) => item.id)).toEqual(['e-2']);
  });

  it('matches every status in the list, so the live queue is the two states at once', async () => {
    const repository = new InMemorySkillEvidenceRepository();
    await seed(repository, [
      {
        id: 'e-1', profileSkillId: 'ps-1', skillId: 'sk-1',
        category: 'Programming', status: 'pending', submittedAt: AT(1),
      },
      {
        id: 'e-2', profileSkillId: 'ps-2', skillId: 'sk-2',
        category: 'Programming', status: 'claimed', submittedAt: AT(2),
      },
      {
        id: 'e-3', profileSkillId: 'ps-3', skillId: 'sk-3',
        category: 'Programming', status: 'claimed', submittedAt: AT(3),
      },
    ]);
    // Decide `e-3` through the repository's own port rather than poking at its rows: the point
    // is that a decided row is excluded from the live view, which only means something if the
    // row really went through the decision path.
    await repository.decide({
      evidenceId: 'e-3',
      status: 'approved',
      reviewerId: 'vf-1',
      approvedLevel: 'intermediate',
      reason: null,
      decidedAt: AT(4),
      skillId: 'sk-3',
      ownerId: 'acc-1',
    });
    const handler = new ListAdminVerifierQueueQueryHandler(repository);

    // The queue's default view: unclaimed + in review, with the already-decided row excluded.
    const live = await handler.execute({ status: ['pending', 'claimed'] });

    expect(live.items.map((item) => item.id).sort()).toEqual(['e-1', 'e-2']);
    expect(live.page.total).toBe(2);

    // And the decided row is still reachable when asked for explicitly.
    const decided = await handler.execute({ status: ['approved'] });
    expect(decided.items.map((item) => item.id)).toEqual(['e-3']);
  });

  it('searches the skill name', async () => {
    const repository = new InMemorySkillEvidenceRepository();
    await seed(repository, [
      {
        id: 'e-1', profileSkillId: 'ps-1', skillId: 'typescript',
        category: 'Programming', skillName: 'TypeScript', submittedAt: AT(1),
      },
      {
        id: 'e-2', profileSkillId: 'ps-2', skillId: 'guitar',
        category: 'Music', skillName: 'Guitar', submittedAt: AT(2),
      },
    ]);
    const handler = new ListAdminVerifierQueueQueryHandler(repository);

    const page = await handler.execute({ q: 'typescript' });

    expect(page.items.map((item) => item.id)).toEqual(['e-1']);
  });

  it('pages oldest-first by default with a cursor that terminates', async () => {
    const repository = new InMemorySkillEvidenceRepository();
    await seed(
      repository,
      [1, 2, 3].map((day) => ({
        id: `e-${day}`,
        profileSkillId: `ps-${day}`,
        skillId: `sk-${day}`,
        category: 'Programming',
        submittedAt: AT(day),
      })),
    );
    const handler = new ListAdminVerifierQueueQueryHandler(repository);

    const first = await handler.execute({ limit: 2 });
    expect(first.items.map((item) => item.id)).toEqual(['e-1', 'e-2']);
    expect(first.page.nextCursor).not.toBeNull();

    const second = await handler.execute({ limit: 2, cursor: first.page.nextCursor ?? undefined });
    expect(second.items.map((item) => item.id)).toEqual(['e-3']);
    expect(second.page.nextCursor).toBeNull();
    // `total` describes the filter, not the page.
    expect(second.page.total).toBe(3);
  });

  it('orders newest-first when asked', async () => {
    const repository = new InMemorySkillEvidenceRepository();
    await seed(
      repository,
      [1, 2].map((day) => ({
        id: `e-${day}`,
        profileSkillId: `ps-${day}`,
        skillId: `sk-${day}`,
        category: 'Programming',
        submittedAt: AT(day),
      })),
    );
    const handler = new ListAdminVerifierQueueQueryHandler(repository);

    const page = await handler.execute({ sort: '-submittedAt' });

    expect(page.items.map((item) => item.id)).toEqual(['e-2', 'e-1']);
  });

  it('returns an empty page when the domain has no work', async () => {
    const repository = new InMemorySkillEvidenceRepository();
    const handler = new ListAdminVerifierQueueQueryHandler(repository);

    const page = await handler.execute({ domain: 'Nothing' });

    expect(page.items).toEqual([]);
    expect(page.page.total).toBe(0);
    expect(page.page.nextCursor).toBeNull();
  });
});
