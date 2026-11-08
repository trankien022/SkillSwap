import { ReadVerificationDocumentUseCase } from './read-verification-document.use-case';
import { VerificationNotFoundError } from './decide-student-verification.use-case';
import { DocumentReadDeniedError } from '../domain/document-read-denied';
import { DOWNLOAD_URL_TTL_SECONDS } from './port/out/document-store';
import {
  FakeDocumentStore,
  InMemoryVerificationRepository,
  fixedClock,
} from './testing/verification-fakes';

/**
 * ADR-023 Amendment A: who may open a stored verification document, and what is recorded.
 *
 * These are the assertions that would have caught the original gap — the document was uploaded and
 * written into `document_ref`, and nothing in the product could read it back.
 */

const NOW = new Date('2026-11-08T09:00:00.000Z');

async function seeded() {
  const verifications = new InMemoryVerificationRepository();
  await verifications.create({
    id: 'verification-1',
    accountId: 'learner-1',
    schoolName: 'FPT University',
    major: 'Software Engineering',
    documentRef: 'learner-1/doc-1.pdf',
    submittedAt: NOW,
  });
  const store = new FakeDocumentStore(() => NOW);
  const useCase = new ReadVerificationDocumentUseCase(verifications, store, fixedClock(NOW));
  return { verifications, store, useCase };
}

describe('ReadVerificationDocumentUseCase (ADR-023 Amendment A)', () => {
  it('mints a URL for the document the row points at, not one the caller named', async () => {
    const { useCase } = await seeded();

    const target = await useCase.execute({
      verificationId: 'verification-1',
      actorId: 'admin-1',
      actorRole: 'admin',
    });

    // The object key comes from the verification row. There is no parameter a caller could use to
    // point this at another account's file.
    expect(target.downloadUrl).toContain('learner-1/doc-1.pdf');
    expect(target.expiresAt).toBe(new Date(NOW.getTime() + DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString());
  });

  it('lets a verifier read, because both roles decide on this evidence', async () => {
    const { useCase } = await seeded();

    await expect(
      useCase.execute({ verificationId: 'verification-1', actorId: 'verifier-1', actorRole: 'verifier' }),
    ).resolves.toMatchObject({ downloadUrl: expect.any(String) });
  });

  it.each([['user'], ['teacher'], [undefined], ['']])(
    'refuses role %s and mints nothing',
    async (role) => {
      const { useCase, store } = await seeded();

      await expect(
        useCase.execute({ verificationId: 'verification-1', actorId: 'learner-1', actorRole: role }),
      ).rejects.toBeInstanceOf(DocumentReadDeniedError);

      // A refusal must not leave a live credential behind. The role check runs before the store is
      // touched, so there is no URL to leak even if the response were somehow rendered.
      expect((store as unknown as { calls: unknown[] }).calls ?? []).toEqual([]);
    },
  );

  it('reports an unknown verification as not found rather than as a denial', async () => {
    const { useCase } = await seeded();

    // 404 for a missing row and 403 for the wrong role are different answers: the first is "no such
    // verification", the second is "you may not read this one".
    await expect(
      useCase.execute({ verificationId: 'nope', actorId: 'admin-1', actorRole: 'admin' }),
    ).rejects.toBeInstanceOf(VerificationNotFoundError);
  });

  it('records the read against the reader, not the learner', async () => {
    const { useCase, verifications } = await seeded();

    await useCase.execute({
      verificationId: 'verification-1',
      actorId: 'admin-1',
      actorRole: 'admin',
    });

    expect(verifications.documentReads).toHaveLength(1);
    expect(verifications.documentReads[0]).toEqual({
      verificationId: 'verification-1',
      // ADR-035: actor ≠ subject. Attributing the read to the learner would make the audit row
      // useless for its one purpose.
      accountId: 'learner-1',
      actorId: 'admin-1',
      actorRole: 'admin',
      documentRef: 'learner-1/doc-1.pdf',
      readAt: NOW,
    });
  });

  it('audits every read, including the second one', async () => {
    const { useCase, verifications } = await seeded();
    const command = { verificationId: 'verification-1', actorId: 'admin-1', actorRole: 'admin' };

    await useCase.execute(command);
    await useCase.execute(command);

    // No deduplication: two reads are two events. A "show me the file again" is a second access to
    // somebody's identity document and the log should say so.
    expect(verifications.documentReads).toHaveLength(2);
  });

  it('leaks no URL into the recorded audit input', async () => {
    const { useCase, verifications } = await seeded();

    const target = await useCase.execute({
      verificationId: 'verification-1',
      actorId: 'admin-1',
      actorRole: 'admin',
    });

    // The audit record carries the object key, never the signed URL: the key is useless without a
    // signature, the URL is a 300-second credential.
    const recorded = JSON.stringify(verifications.documentReads);
    expect(recorded).not.toContain('sig=fake');
    expect(recorded).not.toContain(target.downloadUrl);
  });
});
