import { AccessDeniedError } from '../domain/access';
import { EvidenceNotFoundError } from '../domain/evidence';
import {
  EvidenceDocumentMissingError,
  ReadSkillEvidenceDocumentUseCase,
} from './read-skill-evidence-document.use-case';
import {
  InMemoryEvidenceAuditRepository,
  InMemoryProfileSkillRepository,
  InMemorySkillEvidenceRepository,
  fixedClock,
} from './testing/skill-evidence-fakes';
import type { EvidenceDocumentStore } from './port/out/evidence-document-store';

/**
 * FR-003: a reviewer opening certificate evidence.
 *
 * The two things worth pinning: **who** may open it (the same rule the history route uses, not a
 * second one), and that the key signed comes from the stored row — never from the caller — so the
 * route cannot be turned into a reader for arbitrary objects.
 */

const NOW = new Date('2026-11-08T09:00:00.000Z');
const OWNER = 'owner-1';
const REVIEWER = 'verifier-1';
const STRANGER = 'stranger-1';

function store() {
  const calls: { objectKey: string; expiresInSeconds: number }[] = [];
  const fake: EvidenceDocumentStore = {
    async createUploadTarget() {
      throw new Error('not used');
    },
    async createDownloadTarget(input) {
      calls.push(input);
      return {
        downloadUrl: `https://s3.local/${input.objectKey}?sig=fake`,
        expiresAt: new Date(NOW.getTime() + input.expiresInSeconds * 1000),
      };
    },
  };
  return { fake, calls };
}

async function seed(
  over: {
    documentRef?: string | null;
    evidenceType?: 'certificate' | 'verifier_assessment';
    claimedBy?: string | null;
    reviewerId?: string | null;
  } = {},
) {
  const profileSkills = new InMemoryProfileSkillRepository();
  const evidence = new InMemorySkillEvidenceRepository();
  const audit = new InMemoryEvidenceAuditRepository();
  const { fake, calls } = store();

  const link = await profileSkills.findOrCreate(OWNER, 'sk-1');
  const created = await evidence.create({
    id: 'ev-1',
    profileSkillId: link.id,
    evidenceType: over.evidenceType ?? 'certificate',
    documentRef: over.documentRef === undefined ? `${OWNER}/cert.pdf` : over.documentRef,
    description: 'Portfolio reviewed in person',
    requestedLevel: 'intermediate',
    accountId: OWNER,
    skillId: 'sk-1',
    submittedAt: NOW,
  });
  // The create path decides `documentRef` from its own arguments; override the row so a spec can
  // describe a claimed or reviewed version.
  evidence.rows[0] = Object.assign(Object.create(Object.getPrototypeOf(created)), {
    ...created,
    claimedBy: over.claimedBy ?? null,
    reviewerId: over.reviewerId ?? null,
  });

  const useCase = new ReadSkillEvidenceDocumentUseCase(
    evidence,
    profileSkills,
    audit,
    fake,
    fixedClock(NOW),
  );
  return { useCase, audit, calls };
}

describe('ReadSkillEvidenceDocumentUseCase (FR-003)', () => {
  it('lets the owner open their own certificate', async () => {
    const { useCase, calls } = await seed();

    const target = await useCase.execute({
      evidenceId: 'ev-1',
      viewerId: OWNER,
      viewerRole: 'student',
    });

    expect(target.downloadUrl).toContain(`${OWNER}/cert.pdf`);
    // The 300 s cap ADR-023 Amendment A sets, inherited rather than re-decided.
    expect(calls[0].expiresInSeconds).toBe(300);
    expect(target.expiresAt).toBe(new Date(NOW.getTime() + 300 * 1000).toISOString());
  });

  it('lets an administrator open any certificate', async () => {
    const { useCase } = await seed();

    await expect(
      useCase.execute({ evidenceId: 'ev-1', viewerId: 'admin-1', viewerRole: 'admin' }),
    ).resolves.toBeDefined();
  });

  it('lets a verifier who has not claimed this evidence open it', async () => {
    // This is the workflow the ADR allows and an earlier draft broke: claims are permanent, so a
    // Verifier has to be able to look at the file *before* deciding whether to take the row.
    const { useCase } = await seed();

    await expect(
      useCase.execute({ evidenceId: 'ev-1', viewerId: REVIEWER, viewerRole: 'verifier' }),
    ).resolves.toBeDefined();
  });

  it('refuses a verifier who is not a verifier by role, whatever their claim', async () => {
    const { useCase, calls } = await seed({ claimedBy: REVIEWER });

    // Ownership and role are the permission; being named on the row does not substitute for either
    // if the token carries no such role.
    await expect(
      useCase.execute({ evidenceId: 'ev-1', viewerId: REVIEWER, viewerRole: 'student' }),
    ).rejects.toBeInstanceOf(AccessDeniedError);

    expect(calls).toEqual([]);
  });

  it('refuses another learner, even though they hold the same role as the owner', async () => {
    const { useCase } = await seed();

    await expect(
      useCase.execute({ evidenceId: 'ev-1', viewerId: STRANGER, viewerRole: 'student' }),
    ).rejects.toBeInstanceOf(AccessDeniedError);
  });

  it('reports a missing evidence row as 404, not 403', async () => {
    const { useCase } = await seed();

    await expect(
      useCase.execute({ evidenceId: 'ev-nope', viewerId: OWNER, viewerRole: 'student' }),
    ).rejects.toBeInstanceOf(EvidenceNotFoundError);
  });

  it('says "no document" for a description-only assessment, rather than 404', async () => {
    const { useCase, calls } = await seed({
      evidenceType: 'verifier_assessment',
      documentRef: null,
    });

    // A `verifier_assessment` legitimately carries no file; that is a different fact from "this
    // evidence does not exist", and the caller needs to be able to tell them apart.
    await expect(
      useCase.execute({ evidenceId: 'ev-1', viewerId: OWNER, viewerRole: 'student' }),
    ).rejects.toBeInstanceOf(EvidenceDocumentMissingError);
    expect(calls).toEqual([]);
  });

  it('signs the stored key, not anything the caller supplied', async () => {
    const { useCase, calls } = await seed();

    await useCase.execute({
      evidenceId: 'ev-1',
      viewerId: OWNER,
      viewerRole: 'student',
      // @ts-expect-error — the port has no such field; the call must ignore it if one is smuggled in.
      objectKey: 'someone-else/secret.pdf',
    });

    expect(calls[0].objectKey).toBe(`${OWNER}/cert.pdf`);
  });

  it('records who read which file, with no URL in the record', async () => {
    const { useCase, audit } = await seed();

    await useCase.execute({ evidenceId: 'ev-1', viewerId: REVIEWER, viewerRole: 'verifier' });

    expect(audit.documentReads).toHaveLength(1);
    expect(audit.documentReads[0]).toMatchObject({
      evidenceId: 'ev-1',
      // The owner of the evidence, not the reader — the two are different people here.
      accountId: OWNER,
      documentRef: `${OWNER}/cert.pdf`,
      actorId: REVIEWER,
      actorRole: 'verifier',
      readAt: NOW,
    });
    // A row retained forever must not contain a credential that lives 300 seconds.
    expect(JSON.stringify(audit.documentReads[0])).not.toContain('sig=fake');
  });

  it('writes no audit row when it refuses', async () => {
    const { useCase, audit } = await seed();

    await expect(
      useCase.execute({ evidenceId: 'ev-1', viewerId: STRANGER, viewerRole: 'student' }),
    ).rejects.toBeInstanceOf(AccessDeniedError);

    expect(audit.documentReads).toEqual([]);
  });
});
