import { evidenceDocumentUploadRequestSchema, evidenceDocumentUploadTargetSchema } from './skill-evidence';

/**
 * FR-003 / ADR-038: the certificate-evidence upload target.
 *
 * The important assertion is not the happy path but the *shape*: this endpoint used to hand back a
 * pre-signed PUT URL, and a client written against that shape would silently fail against the
 * Cloudinary adapter. Pinning `method`/`fields` here means such a client cannot be reintroduced
 * without a failing test.
 */
describe('evidenceDocumentUploadTargetSchema (FR-003 / ADR-038)', () => {
  const TARGET = {
    uploadUrl: 'https://api.cloudinary.com/v1_1/skillswap/raw/upload',
    method: 'POST' as const,
    fields: {
      timestamp: '1760000000',
      public_id: 'a1/d1.pdf',
      type: 'authenticated',
      api_key: 'key',
      signature: 'abc123',
    },
    objectKey: 'a1/d1.pdf',
    expiresAt: '2026-10-10T12:15:00.000Z',
  };

  it('accepts a signed multipart form', () => {
    expect(evidenceDocumentUploadTargetSchema.parse(TARGET)).toEqual(TARGET);
  });

  it('requires the signed fields, because the signature alone uploads nothing', () => {
    expect(() =>
      evidenceDocumentUploadTargetSchema.parse({ ...TARGET, fields: undefined }),
    ).toThrow();
  });

  it('rejects a pre-signed PUT shape from the retired S3 adapter', () => {
    expect(() =>
      evidenceDocumentUploadTargetSchema.parse({ ...TARGET, method: 'PUT', fields: undefined }),
    ).toThrow();
  });

  it('requires the object key the submitter must later send as documentRef', () => {
    expect(() =>
      evidenceDocumentUploadTargetSchema.parse({ ...TARGET, objectKey: undefined }),
    ).toThrow();
  });

  it('carries no documentId, so nothing implies a metadata row exists', () => {
    expect(evidenceDocumentUploadTargetSchema.parse(TARGET)).not.toHaveProperty('documentId');
  });
});

describe('evidenceDocumentUploadRequestSchema (FR-003)', () => {
  it('accepts a file name, content type and size', () => {
    const request = { fileName: 'cert.pdf', contentType: 'application/pdf', sizeBytes: 1024 };
    expect(evidenceDocumentUploadRequestSchema.parse(request)).toEqual(request);
  });

  it('rejects a non-positive size', () => {
    expect(() =>
      evidenceDocumentUploadRequestSchema.parse({
        fileName: 'cert.pdf',
        contentType: 'application/pdf',
        sizeBytes: 0,
      }),
    ).toThrow();
  });
});
