import { createHash } from 'node:crypto';
import {
  CloudinaryDocumentStore,
  resourceTypeFor,
  uploadSignature,
} from './cloudinary-document-store';

const fixedNow = new Date('2026-10-10T12:00:00.000Z');

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

describe('uploadSignature (FR-002 / ADR-038)', () => {
  it('sorts fields by key, joins with &, appends the secret and hashes SHA-1', () => {
    // Pinned: the field order is part of Cloudinary's contract, so this must not drift.
    const signature = uploadSignature(
      { timestamp: '1315060510', public_id: 'a1/d1', type: 'authenticated' },
      'secret',
    );
    // sha1('public_id=a1/d1&timestamp=1315060510&type=authenticatedsecret')
    expect(signature).toBe(
      createHash('sha1')
        .update('public_id=a1/d1&timestamp=1315060510&type=authenticatedsecret', 'utf8')
        .digest('hex'),
    );
    expect(signature).toMatch(/^[0-9a-f]{40}$/);
  });

  it('changes when any signed field changes', () => {
    const base = { timestamp: '1', public_id: 'a1/d1', type: 'authenticated' };
    expect(uploadSignature(base, 'secret')).not.toBe(
      uploadSignature({ ...base, public_id: 'a1/d2' }, 'secret'),
    );
  });
});

describe('resourceTypeFor (ADR-038 decision 5)', () => {
  it('routes images to image and everything else to raw', () => {
    expect(resourceTypeFor('image/png')).toBe('image');
    expect(resourceTypeFor('image/jpeg')).toBe('image');
    // A PDF is an image asset in Cloudinary's model, but it is uploaded from a
    // non-image content type here, and `raw` keeps its extension — which is what
    // makes the delivered id resolvable.
    expect(resourceTypeFor('application/pdf')).toBe('raw');
  });
});

describe('CloudinaryDocumentStore (FR-002 / ADR-038)', () => {
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
    expect(target.fields.timestamp).toBe(String(Math.floor(fixedNow.getTime() / 1000)));
    expect(target.fields.signature).toBe(
      uploadSignature(
        { timestamp: target.fields.timestamp, public_id: target.fields.public_id, type: 'authenticated' },
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
    expect(raw.objectKey).toBe('a1/d1.pdf');

    const image = await store().createUploadTarget({
      objectKey: 'a1/d1.png',
      contentType: 'image/png',
      expiresInSeconds: 900,
    });
    expect(image.objectKey).toBe('a1/d1');
    expect(image.uploadUrl).toBe('https://api.cloudinary.com/v1_1/skillswap/image/upload');
  });

  it('is deterministic for a fixed clock and reports the advisory expiry', async () => {
    const input = { objectKey: 'a1/d1.pdf', contentType: 'application/pdf', expiresInSeconds: 900 };
    const first = await store().createUploadTarget(input);
    const second = await store().createUploadTarget(input);
    expect(first.fields.signature).toBe(second.fields.signature);
    expect(first.expiresAt).toEqual(new Date(fixedNow.getTime() + 900 * 1000));
  });
});
