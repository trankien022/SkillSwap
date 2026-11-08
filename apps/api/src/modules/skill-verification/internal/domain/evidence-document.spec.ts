import {
  DEFAULT_ALLOWED_CONTENT_TYPES,
  DEFAULT_MAX_UPLOAD_BYTES,
  EvidenceTooLargeError,
  ForeignEvidenceDocumentError,
  InvalidEvidenceFileError,
  UnsupportedEvidenceTypeError,
  assertEvidenceUploadable,
  buildEvidenceObjectKey,
  isClaimableEvidenceKey,
} from './evidence-document';

/**
 * FR-003 / ADR-023 (storage half): the rules a certificate upload has to satisfy.
 *
 * The policy values are fixed here rather than read from config so a test asserts the rule and not
 * the environment. The *references* half is the security-relevant one: `isClaimableEvidenceKey` is
 * what stops a learner naming somebody else's object.
 */

const POLICY = {
  allowedContentTypes: DEFAULT_ALLOWED_CONTENT_TYPES,
  maxBytes: DEFAULT_MAX_UPLOAD_BYTES,
};

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('certificate upload policy (FR-003)', () => {
  it('accepts the three types the identity flow accepts', () => {
    for (const contentType of ['application/pdf', 'image/png', 'image/jpeg']) {
      expect(() =>
        assertEvidenceUploadable({ fileName: 'a.pdf', contentType, sizeBytes: 1024 }, POLICY),
      ).not.toThrow();
    }
  });

  it.each([['text/html'], ['application/zip'], ['image/gif'], [''], ['APPLICATION/PDF']])(
    'refuses %s, so an executable cannot ride in as a certificate',
    (contentType) => {
      expect(() =>
        assertEvidenceUploadable({ fileName: 'a.pdf', contentType, sizeBytes: 10 }, POLICY),
      ).toThrow(UnsupportedEvidenceTypeError);
    },
  );

  it('refuses a file one byte over the cap and accepts exactly the cap', () => {
    expect(() =>
      assertEvidenceUploadable(
        { fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: POLICY.maxBytes },
        POLICY,
      ),
    ).not.toThrow();
    expect(() =>
      assertEvidenceUploadable(
        { fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: POLICY.maxBytes + 1 },
        POLICY,
      ),
    ).toThrow(EvidenceTooLargeError);
  });

  it.each([[0], [-5], [1.5], [Number.NaN]])('refuses size %s', (sizeBytes) => {
    expect(() =>
      assertEvidenceUploadable({ fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes }, POLICY),
    ).toThrow(InvalidEvidenceFileError);
  });

  it('refuses a blank file name', () => {
    expect(() =>
      assertEvidenceUploadable({ fileName: '   ', contentType: 'application/pdf', sizeBytes: 1 }, POLICY),
    ).toThrow(InvalidEvidenceFileError);
  });
});

describe('object keys (FR-003)', () => {
  it('mints <accountId>/<documentId>.<ext>', () => {
    expect(
      buildEvidenceObjectKey({ accountId: ACCOUNT, documentId: 'doc-1', fileName: 'cert.PDF' }),
    ).toBe(`${ACCOUNT}/doc-1.pdf`);
  });

  it.each([['cert.PDF']])('lowercases the extension (%s)', (fileName) => {
    expect(buildEvidenceObjectKey({ accountId: ACCOUNT, documentId: 'd', fileName })).toBe(
      `${ACCOUNT}/d.pdf`,
    );
  });

  it.each([['cert'], ['cert.'], ['cert.a-b'], ['cert.a b'], ['cert.' + 'x'.repeat(20)]])(
    'keeps no extension from %s, rather than passing an unconstrained tail through',
    (fileName) => {
      // The rule is "short and alphanumeric, or nothing". It is NOT a malware filter — `.php` is
      // alphanumeric and survives it, which is fine: the bucket is private, nothing executes, and
      // the control that actually matters is the content-type allow-list asserted above. What this
      // rule buys is that a name cannot contribute punctuation, spaces or an unbounded tail to the
      // key.
      const key = buildEvidenceObjectKey({ accountId: ACCOUNT, documentId: 'd', fileName });
      expect(key).toBe(`${ACCOUNT}/d`);
    },
  );

  it('accepts a key minted for the same account', () => {
    const key = buildEvidenceObjectKey({ accountId: ACCOUNT, documentId: 'd', fileName: 'c.pdf' });
    expect(isClaimableEvidenceKey(key, ACCOUNT)).toBe(true);
  });

  it("refuses a key minted for a different account", () => {
    // This is the whole point: another account's id is not secret, so without this check a learner
    // could name a real object belonging to somebody else and have a reviewer open it.
    const foreign = buildEvidenceObjectKey({ accountId: OTHER, documentId: 'd', fileName: 'c.pdf' });
    expect(isClaimableEvidenceKey(foreign, ACCOUNT)).toBe(false);
  });

  it('names the refusal, so the filter can answer 403 rather than a generic error', () => {
    const error = new ForeignEvidenceDocumentError(`${OTHER}/d.pdf`);
    // The HTTP filter maps by `name`; renaming this class without adding the new name there would
    // silently turn a 403 refusal into a 500.
    expect(error.name).toBe('ForeignEvidenceDocumentError');
    expect(error.message).toContain(`${OTHER}/d.pdf`);
  });

  it('lets a free-form reference through, because it cannot open anything', () => {
    // `docs/cert.pdf` has been a legal `documentRef` since the contract was written. Refusing it now
    // would break every client already sending one; it grants nothing, since the download route
    // signs it and S3 answers NoSuchKey.
    expect(isClaimableEvidenceKey('docs/cert.pdf', ACCOUNT)).toBe(true);
    expect(isClaimableEvidenceKey('https://example.com/c.pdf', ACCOUNT)).toBe(true);
  });
});
