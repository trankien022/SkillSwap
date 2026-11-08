import {
  privateDownloadUrl,
  publicIdFor,
  resourceTypeFor,
  resourceTypeForObjectKey,
  signFields,
  uploadUrlFor,
} from '../../../../../../shared/storage/cloudinary-sign';
import {
  EVIDENCE_DOWNLOAD_URL_TTL_SECONDS,
  EvidenceDownloadTtlTooLongError,
  type EvidenceDocumentStore,
} from '../../../application/port/out/evidence-document-store';

export interface CloudinaryEvidenceDocumentStoreOptions {
  /** Product environment (the `<cloud>` segment of every Cloudinary URL). */
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Injectable clock so the signature timestamp is deterministic in tests. */
  now?: () => Date;
}

/**
 * FR-003 / ADR-038: `EvidenceDocumentStore` backed by Cloudinary, the same account that stores
 * identity documents.
 *
 * The signing arithmetic is `shared/storage/cloudinary-sign`, so this class and
 * `student-verification`'s adapter cannot disagree about what Cloudinary is told. What stays here
 * is this module's policy: its own port shape and its own TTL check. That split is deliberate —
 * the part that is easy to get subtly wrong once is shared, and the part that is one `if` is not.
 *
 * Certificates go up as `type: authenticated`: a certificate is somebody's identity document too,
 * so it must not be readable at a guessable CDN path (NFR-004).
 */
export class CloudinaryEvidenceDocumentStore implements EvidenceDocumentStore {
  private readonly now: () => Date;

  constructor(private readonly options: CloudinaryEvidenceDocumentStoreOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async createUploadTarget(input: {
    readonly objectKey: string;
    readonly contentType: string;
    readonly expiresInSeconds: number;
  }): Promise<{
    uploadUrl: string;
    method: 'POST';
    fields: Record<string, string>;
    objectKey: string;
    expiresAt: Date;
  }> {
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
      // The **domain** object key, not Cloudinary's stripped public id: this is what the submitter
      // sends back as `documentRef`, and the read path rebuilds the URL from it alone.
      objectKey: input.objectKey,
      expiresAt: new Date(now.getTime() + input.expiresInSeconds * 1000),
    };
  }

  async createDownloadTarget(input: {
    readonly objectKey: string;
    readonly expiresInSeconds: number;
  }): Promise<{ downloadUrl: string; expiresAt: Date }> {
    if (
      !Number.isInteger(input.expiresInSeconds) ||
      input.expiresInSeconds <= 0 ||
      input.expiresInSeconds > EVIDENCE_DOWNLOAD_URL_TTL_SECONDS
    ) {
      // Refuse rather than clamp — the same rule and the same reason as ADR-023 Amendment A.
      throw new EvidenceDownloadTtlTooLongError(
        input.expiresInSeconds,
        EVIDENCE_DOWNLOAD_URL_TTL_SECONDS,
      );
    }

    const now = this.now();
    const timestamp = Math.floor(now.getTime() / 1000);

    return {
      downloadUrl: privateDownloadUrl(this.options, {
        objectKey: input.objectKey,
        resourceType: resourceTypeForObjectKey(input.objectKey),
        timestamp,
        expiresAtSeconds: timestamp + input.expiresInSeconds,
      }),
      expiresAt: new Date(now.getTime() + input.expiresInSeconds * 1000),
    };
  }
}
