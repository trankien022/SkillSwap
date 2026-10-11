import {
  DEFAULT_ALLOWED_CONTENT_TYPES,
  DEFAULT_MAX_UPLOAD_BYTES,
  DocumentTooLargeError,
  InvalidDocumentFileError,
  UnsupportedDocumentTypeError,
  assertUploadable,
  buildObjectKey,
} from './document-upload';

const policy = { allowedContentTypes: DEFAULT_ALLOWED_CONTENT_TYPES, maxBytes: DEFAULT_MAX_UPLOAD_BYTES };

describe('document upload policy (FR-002 / ADR-023, NFR-008)', () => {
  it('accepts an allowed type within the size bound', () => {
    expect(() =>
      assertUploadable(
        { fileName: 'transcript.pdf', contentType: 'application/pdf', sizeBytes: 1024 },
        policy,
      ),
    ).not.toThrow();
  });

  it('rejects an unsupported content type', () => {
    expect(() =>
      assertUploadable(
        { fileName: 'x.exe', contentType: 'application/x-msdownload', sizeBytes: 10 },
        policy,
      ),
    ).toThrow(UnsupportedDocumentTypeError);
  });

  it('rejects an oversized document', () => {
    expect(() =>
      assertUploadable(
        { fileName: 'big.pdf', contentType: 'application/pdf', sizeBytes: DEFAULT_MAX_UPLOAD_BYTES + 1 },
        policy,
      ),
    ).toThrow(DocumentTooLargeError);
  });

  it('rejects an empty file name or non-positive size', () => {
    expect(() =>
      assertUploadable({ fileName: '  ', contentType: 'application/pdf', sizeBytes: 1 }, policy),
    ).toThrow(InvalidDocumentFileError);
    expect(() =>
      assertUploadable({ fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 0 }, policy),
    ).toThrow(InvalidDocumentFileError);
  });

  it('builds a namespaced object key and keeps only a safe extension', () => {
    expect(buildObjectKey({ accountId: 'a1', documentId: 'd1', fileName: 'transcript.PDF' })).toBe(
      'a1/d1.pdf',
    );
    expect(buildObjectKey({ accountId: 'a1', documentId: 'd1', fileName: 'no-ext' })).toBe('a1/d1');
    expect(buildObjectKey({ accountId: 'a1', documentId: 'd1', fileName: 'evil.sh' })).toBe(
      'a1/d1.sh',
    );
  });
});
