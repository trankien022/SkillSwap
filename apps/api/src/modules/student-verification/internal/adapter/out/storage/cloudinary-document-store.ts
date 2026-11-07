import { createHash } from 'node:crypto';
import type {
  CreateUploadTargetInput,
  DocumentStore,
  UploadTarget,
} from '../../../application/port/out/document-store';

export interface CloudinaryDocumentStoreOptions {
  /** Product environment (the `<cloud>` segment of every Cloudinary URL). */
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Injectable clock so the signature timestamp is deterministic in tests. */
  now?: () => Date;
}

/**
 * Cloudinary derives `resource_type` from the file itself at `/auto/upload`. Deriving it here
 * instead makes the routing a testable function, and it matters: a `raw` public id must keep
 * the file extension or the asset is unreachable (ADR-038 decision 5).
 */
export function resourceTypeFor(contentType: string): 'image' | 'raw' {
  return contentType.startsWith('image/') ? 'image' : 'raw';
}

/**
 * The Cloudinary upload signature: the signed fields as `k=v` pairs sorted by key and joined
 * with `&`, plus the API secret appended with no delimiter, hashed SHA-1 and hex encoded.
 *
 * `file`, `cloud_name`, `resource_type` and `api_key` are excluded — Cloudinary never signs
 * them. Field order is part of the contract, so it is pinned by a test rather than left to
 * the call site.
 */
export function uploadSignature(
  fields: Readonly<Record<string, string>>,
  apiSecret: string,
): string {
  const serialized = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('&');
  return createHash('sha1').update(`${serialized}${apiSecret}`, 'utf8').digest('hex');
}

/**
 * FR-002 / ADR-038: Cloudinary document storage.
 *
 * Cloudinary has no pre-signed-URL upload, so a target is the endpoint plus the exact signed
 * field map a client must re-post. Documents go up as `type: authenticated`, which makes both
 * the original and any derived asset reachable only through a signed delivery URL — identity
 * papers must not be readable at a guessable CDN path (NFR-004).
 */
export class CloudinaryDocumentStore implements DocumentStore {
  private readonly now: () => Date;

  constructor(private readonly options: CloudinaryDocumentStoreOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget> {
    const now = this.now();
    const resourceType = resourceTypeFor(input.contentType);
    const timestamp = Math.floor(now.getTime() / 1000);
    const publicId = publicIdFor(input.objectKey, resourceType);

    // Everything except file/cloud_name/resource_type/api_key, plus a mandatory timestamp.
    const signedFields: Record<string, string> = {
      timestamp: String(timestamp),
      public_id: publicId,
      type: 'authenticated',
    };

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.options.cloudName}/${resourceType}/upload`,
      method: 'POST',
      fields: {
        ...signedFields,
        api_key: this.options.apiKey,
        signature: uploadSignature(signedFields, this.options.apiSecret),
      },
      objectKey: publicId,
      expiresAt: new Date(now.getTime() + input.expiresInSeconds * 1000),
    };
  }

  async delete(objectKey: string): Promise<void> {
    // Best-effort: deleting an abandoned upload is off the MVP's hot path and the metadata row
    // stays authoritative, exactly as the S3 adapter left it. Kept as a seam so a cleanup job
    // can implement it without changing callers.
    void objectKey;
  }
}

/**
 * Cloudinary public ids must not carry a leading slash and, for `raw` assets, must keep the
 * file extension — otherwise the delivered URL 404s. Object keys already look like
 * `<accountId>/<documentId>.<ext>`, so this only normalises the edges.
 */
function publicIdFor(objectKey: string, resourceType: 'image' | 'raw'): string {
  const trimmed = objectKey.replace(/^\/+/, '');
  if (resourceType === 'image') {
    // Cloudinary appends the format itself for image assets; an extension in the id would
    // become `name.pdf.jpg`.
    return trimmed.replace(/\.(png|jpe?g|pdf)$/i, '');
  }
  return trimmed;
}
