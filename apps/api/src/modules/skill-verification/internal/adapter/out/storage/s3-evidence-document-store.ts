import { presignS3Url, type S3PresignOptions } from '../../../../../../shared/storage/s3-presign';
import {
  EVIDENCE_DOWNLOAD_URL_TTL_SECONDS,
  EvidenceDownloadTtlTooLongError,
  type EvidenceDocumentStore,
} from '../../../application/port/out/evidence-document-store';

export interface S3EvidenceDocumentStoreOptions extends S3PresignOptions {
  /** Injectable clock so the signature date is deterministic in tests. */
  now?: () => Date;
}

/**
 * FR-003 / ADR-023: `EvidenceDocumentStore` backed by the same S3-compatible store as identity
 * documents.
 *
 * The SigV4 arithmetic is `shared/storage/s3-presign`, so this class and `student-verification`'s
 * adapter cannot disagree about canonicalisation. What stays here is this module's policy: its own
 * port shape and its own TTL check. That split is deliberate — the part that is easy to get subtly
 * wrong once is shared, and the part that is one `if` is not.
 */
export class S3EvidenceDocumentStore implements EvidenceDocumentStore {
  private readonly now: () => Date;

  constructor(private readonly options: S3EvidenceDocumentStoreOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async createUploadTarget(input: {
    readonly objectKey: string;
    readonly contentType: string;
    readonly expiresInSeconds: number;
  }): Promise<{ uploadUrl: string; objectKey: string; expiresAt: Date }> {
    const { url, expiresAt } = presignS3Url(
      this.options,
      'PUT',
      input.objectKey,
      input.expiresInSeconds,
      this.now(),
    );
    return { uploadUrl: url, objectKey: input.objectKey, expiresAt };
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
    const { url, expiresAt } = presignS3Url(
      this.options,
      'GET',
      input.objectKey,
      input.expiresInSeconds,
      this.now(),
    );
    return { downloadUrl: url, expiresAt };
  }
}
