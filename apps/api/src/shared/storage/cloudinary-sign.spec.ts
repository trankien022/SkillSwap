import { createHash } from 'node:crypto';
import {
  deliveryFormatFor,
  privateDownloadUrl,
  publicIdFor,
  resourceTypeFor,
  resourceTypeForObjectKey,
  signFields,
  uploadUrlFor,
} from './cloudinary-sign';

const OPTIONS = {
  cloudName: 'skillswap',
  apiKey: 'api-key',
  apiSecret: 'api-secret',
};

function query(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('signFields (ADR-038)', () => {
  it('sorts fields by key, joins with &, appends the secret and hashes SHA-1', () => {
    // Pinned: the field order is part of Cloudinary's contract, so this must not drift.
    const signature = signFields(
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
    expect(signFields(base, 'secret')).not.toBe(
      signFields({ ...base, public_id: 'a1/d2' }, 'secret'),
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

describe('publicIdFor (ADR-038 decision 5)', () => {
  it('keeps the extension for raw assets and drops it for image assets', () => {
    expect(publicIdFor('a1/d1.pdf', 'raw')).toBe('a1/d1.pdf');
    expect(publicIdFor('a1/d1.png', 'image')).toBe('a1/d1');
  });

  it('strips leading slashes so the delivered path does not double up', () => {
    expect(publicIdFor('//a1/d1.pdf', 'raw')).toBe('a1/d1.pdf');
  });
});

describe('deliveryFormatFor (ADR-038 read path)', () => {
  it('names no format for raw assets, whose public id already carries it', () => {
    expect(deliveryFormatFor('a1/d1.pdf', 'raw')).toBeNull();
  });

  it('names the format for image assets, read from the original key', () => {
    // The public id was stripped by `publicIdFor`, so the key is the only source of this.
    expect(deliveryFormatFor('a1/d1.png', 'image')).toBe('png');
    expect(deliveryFormatFor('a1/d1.JPEG', 'image')).toBe('jpeg');
  });

  it('returns null when an image key has no extension', () => {
    expect(deliveryFormatFor('a1/d1', 'image')).toBeNull();
  });
});

describe('resourceTypeForObjectKey (ADR-038 read path)', () => {
  it('reads a known image extension as image and everything else as raw', () => {
    // The read path only has the stored key, so this must be the exact inverse of the upload
    // routing or a download URL would target the wrong endpoint.
    expect(resourceTypeForObjectKey('a1/d1.png')).toBe('image');
    expect(resourceTypeForObjectKey('a1/d1.jpeg')).toBe('image');
    expect(resourceTypeForObjectKey('a1/d1.pdf')).toBe('raw');
    expect(resourceTypeForObjectKey('a1/d1.zip')).toBe('raw');
  });

  it('reads an extensionless key as raw, the store buildObjectKey defaults to', () => {
    expect(resourceTypeForObjectKey('a1/d1')).toBe('raw');
  });
});

describe('uploadUrlFor (ADR-038)', () => {
  it('targets the resource-typed upload endpoint', () => {
    expect(uploadUrlFor(OPTIONS, 'raw')).toBe(
      'https://api.cloudinary.com/v1_1/skillswap/raw/upload',
    );
    expect(uploadUrlFor(OPTIONS, 'image')).toBe(
      'https://api.cloudinary.com/v1_1/skillswap/image/upload',
    );
  });
});

describe('privateDownloadUrl (ADR-023 Amendment A)', () => {
  const INPUT = {
    objectKey: 'a1/d1.pdf',
    resourceType: 'raw' as const,
    expiresAtSeconds: 1_760_000_300,
    timestamp: 1_760_000_000,
  };

  it('signs timestamp/public_id/type/expires_at and never the secret', () => {
    const url = privateDownloadUrl(OPTIONS, INPUT);
    const params = query(url);

    expect(params.get('timestamp')).toBe('1760000000');
    expect(params.get('public_id')).toBe('a1/d1.pdf');
    expect(params.get('type')).toBe('authenticated');
    expect(params.get('expires_at')).toBe('1760000300');
    expect(params.get('api_key')).toBe('api-key');
    // A raw asset needs no separate format: the extension is inside the public id.
    expect(params.get('format')).toBeNull();
    expect(url).not.toContain('api-secret');
  });

  it('pins the signature to the exact documented payload', () => {
    const url = privateDownloadUrl(OPTIONS, INPUT);
    const expected = signFields(
      {
        timestamp: '1760000000',
        public_id: 'a1/d1.pdf',
        type: 'authenticated',
        expires_at: '1760000300',
      },
      'api-secret',
    );
    expect(query(url).get('signature')).toBe(expected);
  });

  it('sends the stripped public id plus format for an image asset', () => {
    const url = privateDownloadUrl(OPTIONS, {
      ...INPUT,
      objectKey: 'a1/d1.png',
      resourceType: 'image',
    });
    const params = query(url);

    expect(params.get('public_id')).toBe('a1/d1');
    expect(params.get('format')).toBe('png');
    expect(url).toContain('/image/download');
  });

  it('signs expires_at, so a longer window yields a different signature', () => {
    const short = privateDownloadUrl(OPTIONS, INPUT);
    const long = privateDownloadUrl(OPTIONS, { ...INPUT, expiresAtSeconds: 1_760_003_600 });
    expect(query(short).get('signature')).not.toBe(query(long).get('signature'));
  });

  it('is deterministic for a fixed clock', () => {
    expect(privateDownloadUrl(OPTIONS, INPUT)).toBe(privateDownloadUrl(OPTIONS, INPUT));
  });
});
