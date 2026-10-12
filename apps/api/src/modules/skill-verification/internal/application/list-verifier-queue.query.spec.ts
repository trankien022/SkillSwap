import { ListVerifierQueueQueryHandler } from './list-verifier-queue.query';
import {
  InMemorySkillEvidenceRepository,
  InMemoryVerifierRepository,
} from './testing/skill-evidence-fakes';
import type { CreateSkillEvidenceRequest } from './port/out/skill-evidence-repository';

const NOW = new Date('2026-10-11T09:00:00.000Z');

function seedEvidence(
  repo: InMemorySkillEvidenceRepository,
  over: Partial<CreateSkillEvidenceRequest> & { id: string; skillId: string; ownerId: string },
): Promise<unknown> {
  return repo.create({
    profileSkillId: over.profileSkillId ?? `ps-${over.id}`,
    evidenceType: over.evidenceType ?? 'certificate',
    documentRef: 'docs/evidence.pdf',
    description: null,
    requestedLevel: over.requestedLevel ?? 'intermediate',
    accountId: over.ownerId,
    skillId: over.skillId,
    submittedAt: over.submittedAt ?? NOW,
    id: over.id,
  });
}

async function seedQueue(): Promise<InMemorySkillEvidenceRepository> {
  const repo = new InMemorySkillEvidenceRepository();
  // Three pending requests in expertise sk-1, one in sk-2 (out of the verifier's set).
  await seedEvidence(repo, {
    id: 'ev-a',
    skillId: 'sk-1',
    ownerId: 'u1',
    requestedLevel: 'beginner',
    submittedAt: new Date('2026-10-11T08:00:00.000Z'),
  });
  await seedEvidence(repo, {
    id: 'ev-b',
    skillId: 'sk-1',
    ownerId: 'u2',
    requestedLevel: 'advanced',
    submittedAt: new Date('2026-10-11T09:00:00.000Z'),
  });
  await seedEvidence(repo, {
    id: 'ev-c',
    skillId: 'sk-1',
    ownerId: 'u3',
    evidenceType: 'verifier_assessment',
    submittedAt: new Date('2026-10-11T10:00:00.000Z'),
  });
  await seedEvidence(repo, { id: 'ev-x', skillId: 'sk-2', ownerId: 'u4' });
  return repo;
}

function verifierRepo(expertise: string[]): InMemoryVerifierRepository {
  return new InMemoryVerifierRepository([{ accountId: 'vf-1', status: 'active', expertise }]);
}

describe('ListVerifierQueueQueryHandler (FR-004 / NFR-014)', () => {
  it('returns only pending requests in the verifier expertise, oldest first by default', async () => {
    const evidence = await seedQueue();
    const handler = new ListVerifierQueueQueryHandler(evidence, verifierRepo(['sk-1']));
    const page = await handler.execute({ verifierId: 'vf-1' });
    expect(page.items.map((i) => i.id)).toEqual(['ev-a', 'ev-b', 'ev-c']);
    expect(page.page.total).toBe(3);
    expect(page.page.limit).toBe(20);
    expect(page.page.nextCursor).toBeNull();
  });

  it('pages with a keyset cursor and reports the filtered total', async () => {
    const evidence = await seedQueue();
    const handler = new ListVerifierQueueQueryHandler(evidence, verifierRepo(['sk-1']));
    const first = await handler.execute({ verifierId: 'vf-1', limit: 2 });
    expect(first.items.map((i) => i.id)).toEqual(['ev-a', 'ev-b']);
    expect(first.page.total).toBe(3);
    expect(first.page.nextCursor).not.toBeNull();

    const second = await handler.execute({
      verifierId: 'vf-1',
      limit: 2,
      cursor: first.page.nextCursor!,
    });
    expect(second.items.map((i) => i.id)).toEqual(['ev-c']);
    expect(second.page.total).toBe(3);
    expect(second.page.nextCursor).toBeNull();
  });

  it('sorts newest first when asked', async () => {
    const evidence = await seedQueue();
    const handler = new ListVerifierQueueQueryHandler(evidence, verifierRepo(['sk-1']));
    const page = await handler.execute({ verifierId: 'vf-1', sort: '-submittedAt' });
    expect(page.items.map((i) => i.id)).toEqual(['ev-c', 'ev-b', 'ev-a']);
  });

  it('filters by requested level and evidence type', async () => {
    const evidence = await seedQueue();
    const handler = new ListVerifierQueueQueryHandler(evidence, verifierRepo(['sk-1']));
    const level = await handler.execute({ verifierId: 'vf-1', level: 'advanced' });
    expect(level.items.map((i) => i.id)).toEqual(['ev-b']);
    expect(level.page.total).toBe(1);

    const type = await handler.execute({ verifierId: 'vf-1', type: 'verifier_assessment' });
    expect(type.items.map((i) => i.id)).toEqual(['ev-c']);
  });

  it('rejects a non-verifier and an inactive verifier', async () => {
    const evidence = await seedQueue();
    const nonVerifier = new ListVerifierQueueQueryHandler(evidence, verifierRepo([]));
    await expect(nonVerifier.execute({ verifierId: 'nobody' })).rejects.toThrow();

    const suspended = new ListVerifierQueueQueryHandler(
      evidence,
      new InMemoryVerifierRepository([{ accountId: 'vf-2', status: 'suspended', expertise: ['sk-1'] }]),
    );
    await expect(suspended.execute({ verifierId: 'vf-2' })).rejects.toThrow();
  });

  it('returns an empty page when the verifier has no expertise', async () => {
    const evidence = await seedQueue();
    const handler = new ListVerifierQueueQueryHandler(
      evidence,
      new InMemoryVerifierRepository([{ accountId: 'vf-3', status: 'active', expertise: [] }]),
    );
    const page = await handler.execute({ verifierId: 'vf-3' });
    expect(page.items).toEqual([]);
    expect(page.page.total).toBe(0);
  });
});
