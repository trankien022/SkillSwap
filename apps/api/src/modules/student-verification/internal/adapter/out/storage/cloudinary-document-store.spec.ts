import { signFields } from '../../../../../../shared/storage/cloudinary-sign';
import { DOWNLOAD_URL_TTL_SECONDS, DownloadTtlTooLongError } from '../../../application/port/out/document-store';
import { CloudinaryDocumentStore } from './cloudinary-document-store';

const fixedNow = new Date('2026-10-10T12:00:00.000Z');
const FIXED_SECONDS = Math.floor(fixedNow.getTime() / 1000);

function store(
  overrides: Partial<ConstructorParameters<typeof CloudinaryDocumentStore>[0]> = {},
): CloudinaryDocumentStore {
  return new CloudinaryDocumentStore({
    cloudName: 'skillswap',
    apiKey: 'api-key',
    apiSecret: 'api-secret',
    now: () => fixedNow,
    ...overrides,
  });
}

function query(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

/**
 * The signing arithmetic itself is pinned in `shared/storage/cloudinary-sign.spec.ts`. What is
 * pinned here is that this adapter *delegates* to it and applies this module's own rules.
 */
describe('CloudinaryDocumentStore (FR-002 / ADR-038)', () => {
  describe('createUploadTarget', () => {
    it('targets the resource-typed upload endpoint with a POST', async () => {
      const target = await store().createUploadTarget({
        objectKey: 'a1/d1.pdf',
        contentType: 'application/pdf',
        expiresInSeconds: 900,
      });
      expect(target.method).toBe('POST');
      expect(target.uploadUrl).toBe('https://api.cloudinary.com/v1_1/skillswap/raw/upload');
    });

    it('signs timestamp/public_id/type and sends api_key alongside but never the secret', async () => {
      const target = await store().createUploadTarget({
        objectKey: 'a1/d1.pdf',
        contentType: 'application/pdf',
        expiresInSeconds: 900,
      });

      expect(target.fields.api_key).toBe('api-key');
      expect(target.fields.type).toBe('authenticated');
      expect(target.fields.public_id).toBe('a1/d1.pdf');
      expect(target.fields.timestamp).toBe(String(FIXED_SECONDS));
      expect(target.fields.signature).toBe(
        signFields(
          {
            timestamp: target.fields.timestamp,
            public_id: target.fields.public_id,
            type: 'authenticated',
          },
          'api-secret',
        ),
      );
      // The secret must never leave the process.
      expect(JSON.stringify(target.fields)).not.toContain('api-secret');
    });

    it('keeps the extension for raw assets and drops it for image assets', async () => {
      const raw = await store().createUploadTarget({
        objectKey: 'a1/d1.pdf',
        contentType: 'application/pdf',
        expiresInSeconds: 900,
      });
      expect(raw.fields.public_id).toBe('a1/d1.pdf');
      expect(raw.objectKey).toBe('a1/d1.pdf');

      const image = await store().createUploadTarget({
        objectKey: 'a1/d1.png',
        contentType: 'image/png',
        expiresInSeconds: 900,
      });
      expect(image.uploadUrl).toBe('https://api.cloudinary.com/v1_1/skillswap/image/upload');
      // Cloudinary is told the stripped id, because it appends the format itself...
      expect(image.fields.public_id).toBe('a1/d1');
      // ...but the caller keeps the full key, since the read path must rebuild the URL from it.
      expect(image.objectKey).toBe('a1/d1.png');
    });

    it('is deterministic for a fixed clock and reports the advisory expiry', async () => {
      const input = {
        objectKey: 'a1/d1.pdf',
        contentType: 'application/pdf',
        expiresInSeconds: 900,
      };
      const first = await store().createUploadTarget(input);
      const second = await store().createUploadTarget(input);
      expect(first.fields.signature).toBe(second.fields.signature);
      expect(first.expiresAt).toEqual(new Date(fixedNow.getTime() + 900 * 1000));
    });
  });

  describe('createDownloadTarget (ADR-023 Amendment A)', () => {
    it('mints a raw download URL that expires when the caller asked', async () => {
      const target = await store().createDownloadTarget({
        objectKey: 'a1/d1.pdf',
        expiresInSeconds: 300,
      });

      const params = query(target.downloadUrl);
      expect(target.downloadUrl).toContain('/v1_1/skillswap/raw/download');
      expect(params.get('public_id')).toBe('a1/d1.pdf');
      expect(params.get('type')).toBe('authenticated');
      expect(params.get('timestamp')).toBe(String(FIXED_SECONDS));
      // The expiry is signed, so Cloudinary enforces the same window we report.
      expect(params.get('expires_at')).toBe(String(FIXED_SECONDS + 300));
      expect(target.expiresAt).toEqual(new Date(fixedNow.getTime() + 300 * 1000));
    });

    it('sends the stripped public id and an explicit format for an image asset', async () => {
      const target = await store().createDownloadTarget({
        objectKey: 'a1/d1.png',
        expiresInSeconds: 300,
      });

      const params = query(target.downloadUrl);
      expect(target.downloadUrl).toContain('/image/download');
      expect(params.get('public_id')).toBe('a1/d1');
      expect(params.get('format')).toBe('png');
    });

    it('never leaks the API secret into the URL', async () => {
      const target = await store().createDownloadTarget({
        objectKey: 'a1/d1.pdf',
        expiresInSeconds: 300,
      });
      expect(target.downloadUrl).not.toContain('api-secret');
      expect(query(target.downloadUrl).get('api_key')).toBe('api-key');
    });

    it('accepts exactly the 300s cap', async () => {
      await expect(
        store().createDownloadTarget({
          objectKey: 'a1/d1.pdf',
          expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
        }),
      ).resolves.toBeDefined();
    });

    it('refuses a longer window rather than clamping it', async () => {
      await expect(
        store().createDownloadTarget({
          objectKey: 'a1/d1.pdf',
          expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS + 1,
        }),
      ).rejects.toThrow(DownloadTtlTooLongError);
    });

    it('refuses a non-positive or fractional window', async () => {
      for (const expiresInSeconds of [0, -1, 1.5]) {
        await expect(
          store().createDownloadTarget({ objectKey: 'a1/d1.pdf', expiresInSeconds }),
        ).rejects.toThrow(DownloadTtlTooLongError);
      }
    });
  });
});
