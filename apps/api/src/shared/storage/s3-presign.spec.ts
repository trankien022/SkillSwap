import { presignS3Url, type S3PresignOptions } from './s3-presign';

/**
 * The one SigV4 implementation in the codebase.
 *
 * `student-verification` and `skill-verification` both sign against the same bucket, and the whole
 * reason this file exists in `shared/` is so that a canonicalisation change lands once instead of
 * in one copy and not the other. That makes **the signature itself** the thing worth pinning: the
 * module specs assert that their adapter delegates here and gets a well-shaped URL back, but only
 * a golden signature can catch a quiet edit to the canonical request, the encoding, or the signing
 * key derivation. Such an edit produces URLs that look entirely normal and 403 at S3.
 *
 * The expected values below were produced by this implementation and then confirmed against MinIO:
 * the same options with the dev credentials in `.env.example` sign a request that the store
 * accepts. If a test here fails after a deliberate change, regenerate the constants from a run the
 * store actually accepted — do not paste whatever the new code emits, or the test stops testing.
 */

const options: S3PresignOptions = {
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  bucket: 'skillswap-documents',
  accessKeyId: 'skillswap',
  secretAccessKey: 'skillswap_dev_secret',
  forcePathStyle: true,
};

/** Fixed clock: the signature embeds the date, so it cannot be pinned against `new Date()`. */
const now = new Date('2026-10-10T12:00:00.000Z');

function query(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('presignS3Url — SigV4', () => {
  it('signs a PUT with the exact golden signature', () => {
    const { url, expiresAt } = presignS3Url(options, 'PUT', 'a1/d1.pdf', 900, now);

    expect(url).toBe(
      'http://localhost:9000/skillswap-documents/a1/d1.pdf' +
        '?X-Amz-Algorithm=AWS4-HMAC-SHA256' +
        '&X-Amz-Credential=skillswap%2F20261010%2Fus-east-1%2Fs3%2Faws4_request' +
        '&X-Amz-Date=20261010T120000Z' +
        '&X-Amz-Expires=900' +
        '&X-Amz-SignedHeaders=host' +
        '&X-Amz-Signature=f90912f0179544d2868b2ccdae57211c9f223485250f82dccb49766c77bb4ad0',
    );
    expect(expiresAt).toEqual(new Date('2026-10-10T12:15:00.000Z'));
  });

  it('signs a GET with the exact golden signature', () => {
    const { url, expiresAt } = presignS3Url(options, 'GET', 'a1/d1.pdf', 300, now);

    expect(query(url).get('X-Amz-Signature')).toBe(
      'ea73e89d3bd8cbd3d4d65aa44ad8d3162de2e127db8fab3d478c3e34faaff444',
    );
    expect(expiresAt).toEqual(new Date('2026-10-10T12:05:00.000Z'));
  });

  it('signs a GET differently from a PUT of the same object and lifetime', () => {
    // The verb is part of the canonical request. If these ever coincide, one of the two callers is
    // not signing the method it will actually use — a URL that looks correct and 403s at the store.
    const get = query(presignS3Url(options, 'GET', 'a1/d1.pdf', 300, now).url).get('X-Amz-Signature');
    const put = query(presignS3Url(options, 'PUT', 'a1/d1.pdf', 300, now).url).get('X-Amz-Signature');

    expect(get).toMatch(/^[0-9a-f]{64}$/);
    expect(get).not.toBe(put);
  });

  it('is pure: the same inputs produce the same signature', () => {
    const a = presignS3Url(options, 'GET', 'a1/d1.pdf', 300, now);
    const b = presignS3Url(options, 'GET', 'a1/d1.pdf', 300, now);

    expect(a.url).toBe(b.url);
    expect(a.expiresAt).toEqual(b.expiresAt);
  });

  it('dates the expiry from the supplied clock, not from now()', () => {
    // The adapters pass their own `Clock`. If the signer used the wall clock, a pinned test in an
    // adapter would pass while the URL it handed a user expired at some other moment entirely.
    const later = new Date('2026-10-10T12:00:00.000Z');
    const { expiresAt } = presignS3Url(options, 'GET', 'a1/d1.pdf', 60, later);

    expect(expiresAt).toEqual(new Date('2026-10-10T12:01:00.000Z'));
  });

  describe('path style', () => {
    it('puts the bucket in the path when path style is on (MinIO)', () => {
      const { url } = presignS3Url(options, 'GET', 'a1/d1.pdf', 300, now);
      expect(new URL(url).origin).toBe('http://localhost:9000');
      expect(new URL(url).pathname).toBe('/skillswap-documents/a1/d1.pdf');
    });

    it('leaves the bucket out of the path when path style is off (virtual-hosted)', () => {
      const { url } = presignS3Url({ ...options, forcePathStyle: false }, 'GET', 'a1/d1.pdf', 300, now);
      expect(new URL(url).pathname).toBe('/a1/d1.pdf');
    });

    it('signs the two styles differently, because the canonical URI differs', () => {
      const path = query(presignS3Url(options, 'GET', 'a1/d1.pdf', 300, now).url).get('X-Amz-Signature');
      const vhost = query(
        presignS3Url({ ...options, forcePathStyle: false }, 'GET', 'a1/d1.pdf', 300, now).url,
      ).get('X-Amz-Signature');

      expect(path).not.toBe(vhost);
    });
  });

  describe('key encoding', () => {
    it('encodes each path segment and leaves the separators alone', () => {
      const { url } = presignS3Url(options, 'GET', 'a1/sub dir/we!rd(na*me).pdf', 300, now);

      expect(new URL(url).pathname).toBe('/skillswap-documents/a1/sub%20dir/we%21rd%28na%2Ame%29.pdf');
    });

    it('pins the signature for a key that needs encoding', () => {
      // `!()*'` are left alone by `encodeURIComponent` but must be percent-encoded in SigV4. A key
      // that never exercises them would let a wrong `encodeRfc3986` pass unnoticed until a user
      // uploads a file whose name contains one.
      const { url } = presignS3Url(options, 'GET', 'a1/sub dir/we!rd(na*me).pdf', 300, now);

      expect(query(url).get('X-Amz-Signature')).toBe(
        '4759d02adf29f182c494c3ea824a9bc5b657942e01a4ebde159f681d4223db52',
      );
    });

    it('signs a traversal segment literally, so the store rejects it instead of following it', () => {
      // The adapters build the key server-side from a caller's account id and a fresh UUID, so a
      // `..` can never reach here. This pins what happens if it ever does: SigV4 leaves `.` alone,
      // so the *signed* canonical URI contains a literal `..` segment (the string below), while any
      // URL parser collapses it. The two disagree, so the signature does not validate — the request
      // is refused rather than resolving to some other object. Defence by failure, not by trust.
      const { url } = presignS3Url(options, 'GET', '../a1/d1.pdf', 300, now);

      expect(url).toContain('/skillswap-documents/../a1/d1.pdf');
      expect(new URL(url).pathname).toBe('/a1/d1.pdf');
    });
  });

  it('carries no credential other than the signature into the URL', () => {
    // The secret must never appear. The access key id does appear, which is by design and is why
    // the access key is scoped to this bucket in the compose file rather than being an admin key.
    const { url } = presignS3Url(options, 'GET', 'a1/d1.pdf', 300, now);

    expect(url).not.toContain(options.secretAccessKey);
    expect(query(url).get('X-Amz-Credential')).toContain(options.accessKeyId);
  });
});
