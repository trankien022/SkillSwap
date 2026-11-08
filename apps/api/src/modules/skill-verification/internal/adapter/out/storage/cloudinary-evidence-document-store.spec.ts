import { signFields } from '../../../../../../shared/storage/cloudinary-sign';
import {
  EVIDENCE_DOWNLOAD_URL_TTL_SECONDS,
  EvidenceDownloadTtlTooLongError,
} from '../../../application/port/out/evidence-document-store';
import { CloudinaryEvidenceDocumentStore } from './cloudinary-evidence-document-store';

const fixedNow = new Date('2026-10-10T12:00:00.000Z');
const FIXED_SECONDS = Math.floor(fixedNow.getTime() / 1000);

function store(
  overrides: Partial<ConstructorParameters<typeof CloudinaryEvidenceDocumentStore>[0]> = {},
): CloudinaryEvidenceDocumentStore {
  return new CloudinaryEvidenceDocumentStore({
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
 * The signing arithmetic is pinned in `shared/storage/cloudinary-sign.spec.ts`. What is pinned here
 * is that this adapter *delegates* to it and applies this module's own TTL policy.
 */
describe('CloudinaryEvidenceDocumentStore (FR-003 / ADR-038)', () => {
  describe('createUploadTarget', () => {
    it('returns a signed POST form, not a pre-signed URL', async () => {
      const target = await store().createUploadTarget({
        objectKey: 'a1/d1.pdf',
        contentType: 'application/pdf',
        expiresInSeconds: 900,
      });

      expect(target.method).toBe('POST');
      expect(target.uploadUrl).toBe('https://api.cloudinary.com/v1_1/skillswap/raw/upload');
      expect(target.objectKey).toBe('a1/d1.pdf');
      expect(target.expiresAt).toEqual(new Date(fixedNow.getTime() + 900 * 1000));
    });

    it('signs timestamp/public_id/type and never leaks the secret', async () => {
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
      expect(JSON.stringify(target.fields)).not.toContain('api-secret');
    });

    it('routes an image certificate to the image endpoint and strips only the signed id', async () => {
      const target = await store().createUploadTarget({
        objectKey: 'a1/d1.png',
        contentType: 'image/png',
        expiresInSeconds: 900,
      });

      expect(target.uploadUrl).toBe('https://api.cloudinary.com/v1_1/skillswap/image/upload');
      // Cloudinary is told the stripped id; the submitter keeps the full key as `documentRef`.
      expect(target.fields.public_id).toBe('a1/d1');
      expect(target.objectKey).toBe('a1/d1.png');
    });
  });

  describe('createDownloadTarget (ADR-023 Amendment A)', () => {
    it('mints a URL that expires in the same window it reports', async () => {
      const target = await store().createDownloadTarget({
        objectKey: 'a1/d1.pdf',
        expiresInSeconds: EVIDENCE_DOWNLOAD_URL_TTL_SECONDS,
      });

      const params = query(target.downloadUrl);
      expect(target.downloadUrl).toContain('/v1_1/skillswap/raw/download');
      expect(params.get('public_id')).toBe('a1/d1.pdf');
      expect(params.get('type')).toBe('authenticated');
      expect(params.get('expires_at')).toBe(
        String(FIXED_SECONDS + EVIDENCE_DOWNLOAD_URL_TTL_SECONDS),
      );
      expect(target.expiresAt).toEqual(
        new Date(fixedNow.getTime() + EVIDENCE_DOWNLOAD_URL_TTL_SECONDS * 1000),
      );
      expect(target.downloadUrl).not.toContain('api-secret');
    });

    it('refuses a longer window rather than clamping it', async () => {
      await expect(
        store().createDownloadTarget({
          objectKey: 'a1/d1.pdf',
          expiresInSeconds: EVIDENCE_DOWNLOAD_URL_TTL_SECONDS + 1,
        }),
      ).rejects.toThrow(EvidenceDownloadTtlTooLongError);
    });

    it('refuses a non-positive or fractional window', async () => {
      for (const expiresInSeconds of [0, -30, 2.5]) {
        await expect(
          store().createDownloadTarget({ objectKey: 'a1/d1.pdf', expiresInSeconds }),
        ).rejects.toThrow(EvidenceDownloadTtlTooLongError);
      }
    });
  });
});
