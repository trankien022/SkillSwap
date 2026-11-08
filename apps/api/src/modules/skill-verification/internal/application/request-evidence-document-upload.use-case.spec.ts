import { RequestEvidenceDocumentUploadUseCase } from './request-evidence-document-upload.use-case';
import {
  DEFAULT_ALLOWED_CONTENT_TYPES,
  DEFAULT_MAX_UPLOAD_BYTES,
  UnsupportedEvidenceTypeError,
} from '../domain/evidence-document';
import type { EvidenceDocumentStore } from './port/out/evidence-document-store';

/**
 * FR-003: where a certificate goes.
 *
 * The upload target is a write credential, so the assertions that matter are about the key it is
 * for and what the caller was allowed to declare — not about the signature itself, which belongs to
 * the Cloudinary adapter's own tests.
 */

const NOW = new Date('2026-11-08T09:00:00.000Z');
const ACCOUNT = '11111111-1111-4111-8111-111111111111';

function store() {
  const calls: { objectKey: string; contentType: string; expiresInSeconds: number }[] = [];
  const fake: EvidenceDocumentStore = {
    async createUploadTarget(input) {
      calls.push(input);
      return {
        uploadUrl: 'https://api.cloudinary.com/v1_1/fake/raw/upload',
        method: 'POST',
        fields: { timestamp: '1', public_id: input.objectKey, signature: 'fake' },
        objectKey: input.objectKey,
        expiresAt: new Date(NOW.getTime() + input.expiresInSeconds * 1000),
      };
    },
    async createDownloadTarget() {
      throw new Error('not used');
    },
  };
  return { fake, calls };
}

function useCase(overrides: { store: EvidenceDocumentStore; uploadTtlSeconds?: number }) {
  return new RequestEvidenceDocumentUploadUseCase(
    overrides.store,
    { allowedContentTypes: DEFAULT_ALLOWED_CONTENT_TYPES, maxBytes: DEFAULT_MAX_UPLOAD_BYTES },
    overrides.uploadTtlSeconds ?? 900,
  );
}

describe('RequestEvidenceDocumentUploadUseCase (FR-003)', () => {
  it('returns the form, key and expiry the task asks for', async () => {
    const { fake } = store();
    const target = await useCase({ store: fake }).execute({
      accountId: ACCOUNT,
      fileName: 'certificate.pdf',
      contentType: 'application/pdf',
      sizeBytes: 2048,
    });

    // The signature itself is the Cloudinary adapter's contract, not this use case's. What matters
    // here is that the signed form is passed through intact — dropping `fields` would leave a
    // client with a URL it cannot authenticate against.
    expect(target.uploadUrl).toContain('cloudinary.com');
    expect(target.method).toBe('POST');
    expect(target.fields.signature).toBe('fake');
    expect(target.objectKey).toMatch(new RegExp(`^${ACCOUNT}/[0-9a-f-]{36}\\.pdf$`));
    expect(target.expiresAt).toBe(new Date(NOW.getTime() + 900 * 1000).toISOString());
  });

  it('mints the key on the server, under the caller, whatever the file is called', async () => {
    const { fake, calls } = store();
    await useCase({ store: fake }).execute({
      accountId: ACCOUNT,
      fileName: '../../etc/passwd.pdf',
      contentType: 'application/pdf',
      sizeBytes: 10,
    });

    // A traversal in the name cannot escape the account prefix, because the name only contributes
    // the extension.
    expect(calls[0].objectKey.startsWith(`${ACCOUNT}/`)).toBe(true);
    expect(calls[0].objectKey).not.toContain('..');
  });

  it('does not sign anything when the file is refused', async () => {
    const { fake, calls } = store();

    await expect(
      useCase({ store: fake }).execute({
        accountId: ACCOUNT,
        fileName: 'cert.html',
        contentType: 'text/html',
        sizeBytes: 10,
      }),
    ).rejects.toBeInstanceOf(UnsupportedEvidenceTypeError);

    // The validation runs before the store is touched, so a rejected request mints no credential.
    expect(calls).toEqual([]);
  });

  it('carries no document id, because there is no row behind this upload', async () => {
    const { fake } = store();
    const target = await useCase({ store: fake }).execute({
      accountId: ACCOUNT,
      fileName: 'cert.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 10,
    });

    // Inventing an id would be a handle to nothing; the object key is the reference that gets
    // validated at submit time.
    expect(Object.keys(target).sort()).toEqual([
      'expiresAt',
      'fields',
      'method',
      'objectKey',
      'uploadUrl',
    ]);
  });
});
