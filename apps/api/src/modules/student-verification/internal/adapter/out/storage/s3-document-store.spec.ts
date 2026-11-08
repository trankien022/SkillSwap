import { S3DocumentStore } from './s3-document-store';

const fixedNow = new Date('2026-10-10T12:00:00.000Z');

function store(overrides: Partial<ConstructorParameters<typeof S3DocumentStore>[0]> = {}) {
  return new S3DocumentStore({
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

describe('S3DocumentStore (FR-002 / ADR-023)', () => {
  it('issues a path-style SigV4 pre-signed PUT URL', async () => {
    const target = await store().createUploadTarget({
      objectKey: 'a1/d1.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 900,
    });
    const url = new URL(target.uploadUrl);
    expect(url.origin).toBe('http://localhost:9000');
    expect(url.pathname).toBe('/skillswap-documents/a1/d1.pdf');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Credential')).toBe(
      'skillswap/20261010/us-east-1/s3/aws4_request',
    );
    expect(url.searchParams.get('X-Amz-Date')).toBe('20261010T120000Z');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(target.objectKey).toBe('a1/d1.pdf');
    expect(target.expiresAt).toEqual(new Date(fixedNow.getTime() + 900 * 1000));
  });

  it('is deterministic for a fixed clock (stable signature)', async () => {
    const input = { objectKey: 'a1/d1.pdf', contentType: 'application/pdf', expiresInSeconds: 900 };
    const first = await store().createUploadTarget(input);
    const second = await store().createUploadTarget(input);
    expect(first.uploadUrl).toBe(second.uploadUrl);
  });

  it('uses virtual-hosted style when path style is off', async () => {
    const target = await store({ forcePathStyle: false }).createUploadTarget({
      objectKey: 'a1/d1.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 900,
    });
    expect(new URL(target.uploadUrl).pathname).toBe('/a1/d1.pdf');
  });
});

/**
 * ADR-023 Amendment A: the read half.
 *
 * The three properties that matter are pinned here rather than left to review. The **verb** is the
 * one difference from the PUT path, so a signature computed for `PUT` would produce a URL that
 * looks right and 403s at S3 — the kind of defect a UI test would never reach.
 */
describe('S3DocumentStore download target (ADR-023 Amendment A)', () => {
  const target = (ttl = 300) =>
    store().createDownloadTarget({ objectKey: 'a1/d1.pdf', expiresInSeconds: ttl });

  it('signs a GET, and the signature differs from the same request signed as PUT', async () => {
    const download = await target(300);
    const upload = await store().createUploadTarget({
      objectKey: 'a1/d1.pdf',
      contentType: 'application/pdf',
      expiresInSeconds: 300,
    });

    const downloadSignature = new URL(download.downloadUrl).searchParams.get('X-Amz-Signature');
    const uploadSignature = new URL(upload.uploadUrl).searchParams.get('X-Amz-Signature');

    expect(downloadSignature).toMatch(/^[0-9a-f]{64}$/);
    // The canonical request includes the method, so the two must not coincide. If they do, one of
    // the two paths is not signing the verb it claims to.
    expect(downloadSignature).not.toBe(uploadSignature);
  });

  it('returns a URL whose path and query are otherwise identical to the upload form', async () => {
    const download = await target(300);
    const url = new URL(download.downloadUrl);
    expect(url.origin).toBe('http://localhost:9000');
    expect(url.pathname).toBe('/skillswap-documents/a1/d1.pdf');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
  });

  it('expires 300 seconds after the clock, and accepts exactly the cap', async () => {
    const download = await target(300);
    expect(download.expiresAt).toEqual(new Date(fixedNow.getTime() + 300 * 1000));
  });

  it.each([301, 600, 901])(
    'refuses a %is lifetime instead of silently clamping it',
    async (ttl) => {
      // Clamping would ship a URL whose documented lifetime is a lie. Refusing tells the caller
      // that the cap is a rule rather than a default, so nobody widens it by editing a config.
      await expect(target(ttl)).rejects.toThrow(/exceeds the 300s cap/);
    },
  );

  it.each([0, -1, 12.5])('refuses a nonsensical lifetime (%s)', async (ttl) => {
    await expect(target(ttl)).rejects.toThrow(/exceeds the 300s cap/);
  });

  it('does not put anything but the signature in the returned object', async () => {
    // The response shape is the contract: the object key is deliberately absent so a caller cannot
    // mistake a reference for a credential, or persist the wrong one.
    const download = await target(300);
    expect(Object.keys(download).sort()).toEqual(['downloadUrl', 'expiresAt']);
  });
});
