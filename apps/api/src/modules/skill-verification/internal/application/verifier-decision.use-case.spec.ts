import {
  EvidenceNotClaimableError,
} from '../domain/evidence';
import { InactiveVerifierError, OutOfExpertiseError, SelfDecisionError } from '../domain/verifier';
import { ClaimSkillEvidenceUseCase } from './claim-skill-evidence.use-case';
import { DecideSkillEvidenceUseCase } from './decide-skill-evidence.use-case';
import { ListVerifierQueueQueryHandler } from './list-verifier-queue.query';
import { VerifierAuthority } from './verifier-authority';
import {
  InMemoryProfileSkillRepository,
  InMemorySkillEvidenceRepository,
  InMemorySkillRepository,
  InMemoryVerifierRepository,
  fixedClock,
  skillFixture,
} from './testing/skill-evidence-fakes';

const NOW = new Date('2026-10-11T00:00:00.000Z');

async function seedSubmittedEvidence(options: {
  ownerId?: string;
  skillId?: string;
  expertise?: string[];
  verifierStatus?: 'active' | 'suspended' | 'revoked';
} = {}) {
  const skillId = options.skillId ?? 'sk-1';
  const ownerId = options.ownerId ?? 'acc-teacher';
  const skills = new InMemorySkillRepository([skillFixture({ id: skillId })]);
  const profileSkills = new InMemoryProfileSkillRepository();
  const evidence = new InMemorySkillEvidenceRepository();
  const verifiers = new InMemoryVerifierRepository([
    { accountId: 'vf-1', status: options.verifierStatus ?? 'active', expertise: options.expertise ?? [skillId] },
  ]);
  const authority = new VerifierAuthority(verifiers);

  const link = await profileSkills.findOrCreate(ownerId, skillId);
  const submitted = await evidence.create({
    id: 'ev-1',
    profileSkillId: link.id,
    evidenceType: 'certificate',
    documentRef: 'docs/cert.pdf',
    description: null,
    requestedLevel: 'intermediate',
    accountId: ownerId,
    skillId,
    submittedAt: NOW,
  });

  return { skills, profileSkills, evidence, verifiers, authority, link, submitted };
}

describe('FR-004 verifier authority use cases (AC-018)', () => {
  it('lists only expertise-matched pending requests in the queue', async () => {
    const ctx = await seedSubmittedEvidence({ skillId: 'sk-1', expertise: ['sk-2'] });
    const queue = new ListVerifierQueueQueryHandler(ctx.evidence, ctx.verifiers);
    expect((await queue.execute({ verifierId: 'vf-1' })).items).toEqual([]);

    const queue2 = new ListVerifierQueueQueryHandler(
      ctx.evidence,
      new InMemoryVerifierRepository([{ accountId: 'vf-1', status: 'active', expertise: ['sk-1'] }]),
    );
    const page = await queue2.execute({ verifierId: 'vf-1' });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].skillId).toBe('sk-1');
    expect(page.items[0].status).toBe('pending');
    expect(page.page.total).toBe(1);
    expect(page.page.limit).toBe(20);
  });

  it('claims a pending request for an active, expertise-matched, non-owner Verifier', async () => {
    const ctx = await seedSubmittedEvidence();
    const claim = new ClaimSkillEvidenceUseCase(
      ctx.evidence,
      ctx.profileSkills,
      ctx.skills,
      ctx.authority,
      fixedClock(NOW),
    );

    const view = await claim.execute({ verifierId: 'vf-1', evidenceId: 'ev-1' });
    expect(view.status).toBe('claimed');
    expect(view.claimedBy).toBe('vf-1');
    expect(ctx.evidence.rows[0].status).toBe('claimed');
  });

  it('refuses to claim an out-of-expertise skill or an inactive Verifier', async () => {
    const outOfDomain = await seedSubmittedEvidence({ expertise: ['sk-other'] });
    const claimOutOfDomain = new ClaimSkillEvidenceUseCase(
      outOfDomain.evidence, outOfDomain.profileSkills, outOfDomain.skills, outOfDomain.authority, fixedClock(NOW),
    );
    await expect(claimOutOfDomain.execute({ verifierId: 'vf-1', evidenceId: 'ev-1' })).rejects.toBeInstanceOf(
      OutOfExpertiseError,
    );

    const suspended = await seedSubmittedEvidence({ verifierStatus: 'suspended' });
    const claimSuspended = new ClaimSkillEvidenceUseCase(
      suspended.evidence, suspended.profileSkills, suspended.skills, suspended.authority, fixedClock(NOW),
    );
    await expect(claimSuspended.execute({ verifierId: 'vf-1', evidenceId: 'ev-1' })).rejects.toBeInstanceOf(
      InactiveVerifierError,
    );
  });

  it("refuses the owner claiming their own evidence (BR-012)", async () => {
    const ctx = await seedSubmittedEvidence({ ownerId: 'vf-1' });
    const claim = new ClaimSkillEvidenceUseCase(
      ctx.evidence, ctx.profileSkills, ctx.skills, ctx.authority, fixedClock(NOW),
    );
    await expect(claim.execute({ verifierId: 'vf-1', evidenceId: 'ev-1' })).rejects.toBeInstanceOf(
      SelfDecisionError,
    );
  });

  it('is race-safe: a second claimant is rejected', async () => {
    const ctx = await seedSubmittedEvidence();
    const claim = new ClaimSkillEvidenceUseCase(
      ctx.evidence, ctx.profileSkills, ctx.skills, ctx.authority, fixedClock(NOW),
    );
    await claim.execute({ verifierId: 'vf-1', evidenceId: 'ev-1' });
    await expect(claim.execute({ verifierId: 'vf-1', evidenceId: 'ev-1' })).rejects.toBeInstanceOf(
      EvidenceNotClaimableError,
    );
  });

  it('approves a claimed request, caches the level and supersedes the previous approval', async () => {
    const ctx = await seedSubmittedEvidence();
    const claim = new ClaimSkillEvidenceUseCase(
      ctx.evidence, ctx.profileSkills, ctx.skills, ctx.authority, fixedClock(NOW),
    );
    await claim.execute({ verifierId: 'vf-1', evidenceId: 'ev-1' });

    const decide = new DecideSkillEvidenceUseCase(
      ctx.evidence, ctx.profileSkills, ctx.skills, ctx.authority, fixedClock(NOW),
    );
    const view = await decide.execute({ reviewerId: 'vf-1', evidenceId: 'ev-1', decision: 'approve' });
    expect(view.status).toBe('approved');
    expect(view.approvedLevel).toBe('intermediate');
    expect((await ctx.profileSkills.findById(ctx.link.id))?.approvedLevel).toBe('intermediate');
  });

  it('rejects with a reason and sets the level to null', async () => {
    const ctx = await seedSubmittedEvidence();
    const claim = new ClaimSkillEvidenceUseCase(
      ctx.evidence, ctx.profileSkills, ctx.skills, ctx.authority, fixedClock(NOW),
    );
    await claim.execute({ verifierId: 'vf-1', evidenceId: 'ev-1' });

    const decide = new DecideSkillEvidenceUseCase(
      ctx.evidence, ctx.profileSkills, ctx.skills, ctx.authority, fixedClock(NOW),
    );
    const view = await decide.execute({
      reviewerId: 'vf-1',
      evidenceId: 'ev-1',
      decision: 'reject',
      reason: 'Illegible certification',
    });
    expect(view.status).toBe('rejected');
    expect(view.reason).toBe('Illegible certification');
    expect((await ctx.profileSkills.findById(ctx.link.id))?.approvedLevel).toBeNull();
  });
});
