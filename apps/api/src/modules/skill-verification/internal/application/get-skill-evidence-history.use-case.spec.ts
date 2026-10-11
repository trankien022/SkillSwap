import { AccessDeniedError, } from '../domain/access';
import { EvidenceNotFoundError } from '../domain/evidence';
import type { EvidenceAuditEntry, EvidenceAuditSnapshot } from '../domain/history';
import { GetSkillEvidenceHistoryUseCase } from './get-skill-evidence-history.use-case';
import {
  InMemoryEvidenceAuditRepository,
  InMemoryProfileSkillRepository,
  InMemorySkillEvidenceRepository,
} from './testing/skill-evidence-fakes';

const NOW = new Date('2026-10-11T00:00:00.000Z');

function snapshot(over: Partial<EvidenceAuditSnapshot> = {}): EvidenceAuditSnapshot {
  return {
    version: 1,
    status: 'submitted' as never,
    evidenceType: 'certificate',
    requestedLevel: 'intermediate',
    approvedLevel: null,
    reason: null,
    ...over,
  } as EvidenceAuditSnapshot;
}

function auditRow(over: Partial<EvidenceAuditEntry> = {}): EvidenceAuditEntry {
  return {
    id: 'a-1',
    evidenceId: 'ev-1',
    profileSkillId: 'ps-1',
    version: 1,
    action: 'submitted',
    actorId: 'owner-1',
    fromStatus: null,
    toStatus: 'pending',
    reason: null,
    snapshot: snapshot(),
    occurredAt: NOW,
    traceId: null,
    ...over,
  };
}

async function seed() {
  const profileSkills = new InMemoryProfileSkillRepository();
  const evidence = new InMemorySkillEvidenceRepository();
  const audit = new InMemoryEvidenceAuditRepository();

  const link = await profileSkills.findOrCreate('owner-1', 'sk-1');
  const v1 = await evidence.create({
    id: 'ev-1',
    profileSkillId: link.id,
    evidenceType: 'certificate',
    documentRef: 'docs/cert.pdf',
    description: null,
    requestedLevel: 'intermediate',
    accountId: 'owner-1',
    skillId: 'sk-1',
    submittedAt: NOW,
  });
  // Advance v1 to approved (reviewer) then add a v2, to exercise multi-version history.
  await evidence.claim({ evidenceId: 'ev-1', verifierId: 'vf-1', skillId: 'sk-1', ownerId: 'owner-1', claimedAt: NOW });
  await evidence.decide({
    evidenceId: 'ev-1',
    status: 'approved',
    reviewerId: 'vf-1',
    approvedLevel: 'intermediate',
    reason: null,
    decidedAt: NOW,
    skillId: 'sk-1',
    ownerId: 'owner-1',
  });
  const v2 = await evidence.create({
    id: 'ev-2',
    profileSkillId: link.id,
    evidenceType: 'certificate',
    documentRef: 'docs/cert2.pdf',
    description: null,
    requestedLevel: 'advanced',
    accountId: 'owner-1',
    skillId: 'sk-1',
    submittedAt: NOW,
  });

  audit.rows.push(
    auditRow({ id: 'a-v1-sub', version: 1, action: 'submitted', occurredAt: new Date('2026-10-11T00:00:00.000Z') }),
    auditRow({ id: 'a-v1-claim', version: 1, action: 'claimed', actorId: 'vf-1', fromStatus: 'pending', toStatus: 'claimed', occurredAt: new Date('2026-10-11T01:00:00.000Z') }),
    auditRow({ id: 'a-v1-appr', version: 1, action: 'approved', actorId: 'vf-1', fromStatus: 'claimed', toStatus: 'approved', occurredAt: new Date('2026-10-11T02:00:00.000Z') }),
    auditRow({ id: 'a-v2-sub', version: 2, action: 'submitted', toStatus: 'pending', occurredAt: new Date('2026-10-11T03:00:00.000Z') }),
  );

  const useCase = new GetSkillEvidenceHistoryUseCase(evidence, profileSkills, audit);
  return { useCase, link, v1, v2 };
}

describe('GetSkillEvidenceHistoryUseCase (FR-018)', () => {
  it('returns every version newest-first with its ordered audit entries', async () => {
    const { useCase, link } = await seed();
    const view = await useCase.execute({ evidenceId: 'ev-1', viewerId: 'owner-1', viewerRole: 'learner' });

    expect(view.profileSkillId).toBe(link.id);
    expect(view.skillId).toBe('sk-1');
    expect(view.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(view.versions[1].entries.map((e) => e.action)).toEqual(['approved', 'claimed', 'submitted']);
    expect(view.versions[0].currentStatus).toBe('pending');
    expect(view.versions[1].currentStatus).toBe('approved');
  });

  it('lets the reviewing Verifier and an administrator read it', async () => {
    const { useCase } = await seed();
    await expect(
      useCase.execute({ evidenceId: 'ev-1', viewerId: 'vf-1', viewerRole: 'verifier' }),
    ).resolves.toBeDefined();
    await expect(
      useCase.execute({ evidenceId: 'ev-1', viewerId: 'admin-9', viewerRole: 'admin' }),
    ).resolves.toBeDefined();
  });

  it('refuses an unrelated account', async () => {
    const { useCase } = await seed();
    await expect(
      useCase.execute({ evidenceId: 'ev-1', viewerId: 'nosy', viewerRole: 'learner' }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it('raises a not-found error for unknown evidence', async () => {
    const { useCase } = await seed();
    await expect(
      useCase.execute({ evidenceId: 'nope', viewerId: 'owner-1', viewerRole: 'learner' }),
    ).rejects.toBeInstanceOf(EvidenceNotFoundError);
  });
});
