import {
  privateDownloadUrl,
  publicIdFor,
  resourceTypeFor,
  resourceTypeForObjectKey,
  signFields,
  uploadUrlFor,
} from '../../../../../../shared/storage/cloudinary-sign';
import {
  DOWNLOAD_URL_TTL_SECONDS,
  DownloadTtlTooLongError,
  type CreateDownloadTargetInput,
  type CreateUploadTargetInput,
  type DocumentStore,
  type DownloadTarget,
  type UploadTarget,
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
 * FR-002 / ADR-038: Cloudinary document storage.
 *
 * Cloudinary has no pre-signed-URL upload, so a target is the endpoint plus the exact signed
 * field map a client must re-post. Documents go up as `type: authenticated`, which makes both
 * the original and any derived asset reachable only through a credential minted here — identity
 * papers must not be readable at a guessable CDN path (NFR-004).
 *
 * The signing arithmetic is `shared/storage/cloudinary-sign`, so this adapter and
 * `skill-verification`'s evidence store cannot disagree about what Cloudinary is told. What stays
 * here is this module's policy: its port shape and its TTL cap.
 */
export class CloudinaryDocumentStore implements DocumentStore {
  private readonly now: () => Date;

  constructor(private readonly options: CloudinaryDocumentStoreOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget> {
    const now = this.now();
    const resourceType = resourceTypeFor(input.contentType);

    // Everything except file/cloud_name/resource_type/api_key, plus a mandatory timestamp.
    const signedFields: Record<string, string> = {
      timestamp: String(Math.floor(now.getTime() / 1000)),
      public_id: publicIdFor(input.objectKey, resourceType),
      type: 'authenticated',
    };

    return {
      uploadUrl: uploadUrlFor(this.options, resourceType),
      method: 'POST',
      fields: {
        ...signedFields,
        api_key: this.options.apiKey,
        signature: signFields(signedFields, this.options.apiSecret),
      },
      // The **domain** object key, not Cloudinary's stripped public id: this is what the caller
      // persists, and the read path must be able to rebuild the delivery URL from it alone.
      objectKey: input.objectKey,
      expiresAt: new Date(now.getTime() + input.expiresInSeconds * 1000),
    };
  }

  async createDownloadTarget(input: CreateDownloadTargetInput): Promise<DownloadTarget> {
    if (
      !Number.isInteger(input.expiresInSeconds) ||
      input.expiresInSeconds <= 0 ||
      input.expiresInSeconds > DOWNLOAD_URL_TTL_SECONDS
    ) {
      // Refuse rather than clamp: the cap is the safeguard, and a caller that can widen it has
      // removed it. Same rule and same reason as ADR-023 Amendment A.
      throw new DownloadTtlTooLongError(input.expiresInSeconds, DOWNLOAD_URL_TTL_SECONDS);
    }

    const now = this.now();
    const timestamp = Math.floor(now.getTime() / 1000);
    const downloadUrl = privateDownloadUrl(this.options, {
      objectKey: input.objectKey,
      resourceType: resourceTypeForObjectKey(input.objectKey),
      timestamp,
      expiresAtSeconds: timestamp + input.expiresInSeconds,
    });

    return {
      downloadUrl,
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
