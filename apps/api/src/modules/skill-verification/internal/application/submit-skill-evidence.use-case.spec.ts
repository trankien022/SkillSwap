import { NotVerifiedStudentError, UnknownSkillError } from '../domain/evidence';
import { SubmitSkillEvidenceUseCase } from './submit-skill-evidence.use-case';
import {
  InMemoryProfileSkillRepository,
  InMemorySkillEvidenceRepository,
  InMemorySkillRepository,
  InMemoryVerifiedStudentReader,
  fixedClock,
  skillFixture,
} from './testing/skill-evidence-fakes';

const NOW = new Date('2026-10-11T00:00:00.000Z');

function build(options: { verified?: boolean; skills?: Partial<Parameters<typeof skillFixture>[0]>[] } = {}) {
  const skills = new InMemorySkillRepository(
    (options.skills ?? [{}]).map((over) => skillFixture(over)),
  );
  const profileSkills = new InMemoryProfileSkillRepository();
  const evidence = new InMemorySkillEvidenceRepository();
  const verified = new InMemoryVerifiedStudentReader(
    options.verified === false ? new Set() : new Set(['acc-1']),
  );
  const useCase = new SubmitSkillEvidenceUseCase(
    skills,
    profileSkills,
    evidence,
    verified,
    fixedClock(NOW),
  );
  return { useCase, profileSkills, evidence };
}

describe('SubmitSkillEvidenceUseCase', () => {
  it('stores a pending evidence version for a verified student and a known skill', async () => {
    const { useCase, evidence } = build();

    const view = await useCase.execute({
      accountId: 'acc-1',
      skillId: 'sk-1',
      requestedLevel: 'intermediate',
      evidenceType: 'certificate',
      documentRef: 'docs/cert.pdf',
    });

    expect(view.status).toBe('pending');
    expect(view.version).toBe(1);
    expect(view.requestedLevel).toBe('intermediate');
    expect(view.approvedLevel).toBeNull();
    expect(evidence.rows).toHaveLength(1);
  });

  it('rejects an unverified student', async () => {
    const { useCase } = build({ verified: false });

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        skillId: 'sk-1',
        requestedLevel: 'intermediate',
        evidenceType: 'certificate',
        documentRef: 'docs/cert.pdf',
      }),
    ).rejects.toBeInstanceOf(NotVerifiedStudentError);
  });

  it('rejects an unknown skill', async () => {
    const { useCase } = build();

    await expect(
      useCase.execute({
        accountId: 'acc-1',
        skillId: 'sk-unknown',
        requestedLevel: 'intermediate',
        evidenceType: 'certificate',
        documentRef: 'docs/cert.pdf',
      }),
    ).rejects.toBeInstanceOf(UnknownSkillError);
  });

  it('bumps the version and keeps the prior effective approval on resubmission (AC-016)', async () => {
    const { useCase, evidence } = build();

    const first = await useCase.execute({
      accountId: 'acc-1',
      skillId: 'sk-1',
      requestedLevel: 'intermediate',
      evidenceType: 'certificate',
      documentRef: 'docs/cert-1.pdf',
    });

    // Simulate FR-004 approving version 1 (out of scope here): mark it approved.
    evidence.rows[0] = Object.assign(
      Object.create(Object.getPrototypeOf(evidence.rows[0])),
      { ...evidence.rows[0], status: 'approved', approvedLevel: 'intermediate' },
    );

    const second = await useCase.execute({
      accountId: 'acc-1',
      skillId: 'sk-1',
      requestedLevel: 'advanced',
      evidenceType: 'certificate',
      documentRef: 'docs/cert-2.pdf',
    });

    expect(second.version).toBe(first.version + 1);
    expect(second.status).toBe('pending');
    // The approved version is untouched: the effective approval is preserved.
    expect(evidence.rows[0].status).toBe('approved');
    expect(evidence.rows[0].approvedLevel).toBe('intermediate');
  });

  it('reuses the same profile-skill link across submissions', async () => {
    const { useCase, profileSkills } = build();

    await useCase.execute({
      accountId: 'acc-1',
      skillId: 'sk-1',
      requestedLevel: 'beginner',
      evidenceType: 'verifier_assessment',
      description: 'Reviewed portfolio',
    });
    await useCase.execute({
      accountId: 'acc-1',
      skillId: 'sk-1',
      requestedLevel: 'advanced',
      evidenceType: 'verifier_assessment',
      description: 'Reviewed portfolio v2',
    });

    expect(profileSkills.rows).toHaveLength(1);
  });
});
