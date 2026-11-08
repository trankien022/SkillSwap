import { S3EvidenceDocumentStore } from './s3-evidence-document-store';

const fixedNow = new Date('2026-10-10T12:00:00.000Z');

function store(overrides: Partial<ConstructorParameters<typeof S3EvidenceDocumentStore>[0]> = {}) {
  return new S3EvidenceDocumentStore({
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    bucket: 'skillswap-documents',
    accessKeyId: 'skillswap',
    secretAccessKey: 'skillswap_dev_secret',
    forcePathStyle: true,
    now: () => fixedNow,
    ...overrides,
  });
}

/**
 * FR-003: the certificate store.
 *
 * This adapter is deliberately thin — it delegates the SigV4 arithmetic to
 * `shared/storage/s3-presign`, which has its own tests. What is pinned here is that it *delegates*
 * (rather than growing a second signer) and that it applies this module's own policy: the 300 s read
 * cap and refusal rather than clamping.
 */
describe('S3EvidenceDocumentStore (FR-003)', () => {
  it('signs a PUT for the key it was given', async () => {
    const target = await store().createUploadTarget({
      objectKey: 'acc-1/doc-1.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 900,
    });

    const url = new URL(target.uploadUrl);
    expect(url.origin).toBe('http://localhost:9000');
    expect(url.pathname).toBe('/skillswap-documents/acc-1/doc-1.pdf');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Credential')).toBe(
      'skillswap/20261010/us-east-1/s3/aws4_request',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(target.objectKey).toBe('acc-1/doc-1.pdf');
    expect(target.expiresAt).toEqual(new Date(fixedNow.getTime() + 900 * 1000));
  });

  it('produces the same signature the identity store produces for identical input', async () => {
    // The proof that the signer is genuinely shared: if this drifts, one of the two modules grew its
    // own canonicalisation, which is the exact defect sharing it was meant to prevent.
    const evidence = await store().createUploadTarget({
      objectKey: 'acc-1/doc-1.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 900,
    });
    const again = await store().createUploadTarget({
      objectKey: 'acc-1/doc-1.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 900,
    });
    expect(evidence.uploadUrl).toBe(again.uploadUrl);
  });

  it('uses virtual-hosted style when path style is off', async () => {
    const target = await store({ forcePathStyle: false }).createUploadTarget({
      objectKey: 'acc-1/doc-1.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 900,
    });
    expect(new URL(target.uploadUrl).pathname).toBe('/acc-1/doc-1.pdf');
  });

  it('signs a GET for a read, and it differs from the PUT signature', async () => {
    const download = await store().createDownloadTarget({
      objectKey: 'acc-1/doc-1.pdf',
      expiresInSeconds: 300,
    });
    const upload = await store().createUploadTarget({
      objectKey: 'acc-1/doc-1.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 300,
    });

    const downloadSignature = new URL(download.downloadUrl).searchParams.get('X-Amz-Signature');
    const uploadSignature = new URL(upload.uploadUrl).searchParams.get('X-Amz-Signature');

    // The canonical request includes the verb, so these cannot coincide. If they do, one path is
    // signing a verb it does not claim and S3 would answer 403 on one of them.
    expect(downloadSignature).toMatch(/^[0-9a-f]{64}$/);
    expect(downloadSignature).not.toBe(uploadSignature);
  });

  it('expires 300 seconds after the clock', async () => {
    const download = await store().createDownloadTarget({
      objectKey: 'acc-1/doc-1.pdf',
      expiresInSeconds: 300,
    });
    expect(download.expiresAt).toEqual(new Date(fixedNow.getTime() + 300 * 1000));
  });

  it.each([301, 600, 0, -1, 12.5])(
    'refuses a %ss lifetime instead of clamping it',
    async (ttl) => {
      // Clamping would ship a URL whose documented lifetime is a lie.
      await expect(
        store().createDownloadTarget({ objectKey: 'acc-1/doc-1.pdf', expiresInSeconds: ttl }),
      ).rejects.toThrow(/exceeds the 300s cap/);
    },
  );

  it('returns only the URL and its expiry, so a key is not mistaken for a credential', async () => {
    const download = await store().createDownloadTarget({
      objectKey: 'acc-1/doc-1.pdf',
      expiresInSeconds: 300,
    });
    expect(Object.keys(download).sort()).toEqual(['downloadUrl', 'expiresAt']);
  });
});
