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
