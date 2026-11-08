import { presignS3Url, type S3PresignOptions } from '../../../../../../shared/storage/s3-presign';
import {
  DOWNLOAD_URL_TTL_SECONDS,
  DownloadTtlTooLongError,
  type CreateDownloadTargetInput,
  type CreateUploadTargetInput,
  type DocumentStore,
  type DownloadTarget,
  type UploadTarget,
} from '../../../application/port/out/document-store';

export interface S3DocumentStoreOptions extends S3PresignOptions {
  /** Injectable clock so the signature date is deterministic in tests. */
  now?: () => Date;
}

/**
 * FR-002 / ADR-023: `DocumentStore` backed by an S3-compatible store.
 *
 * The SigV4 arithmetic lives in `shared/storage/s3-presign` because `skill-verification` needs the
 * identical signing for certificate evidence against the same bucket. This class is the thin,
 * module-specific half: it maps the port's shapes onto the signer and owns this module's TTL
 * policy. Implemented with `node:crypto` (no SDK dependency), the same "no new dep" pattern as the
 * Jitsi token and the payment webhook HMAC.
 */
export class S3DocumentStore implements DocumentStore {
  private readonly now: () => Date;

  constructor(private readonly options: S3DocumentStoreOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async createUploadTarget(input: CreateUploadTargetInput): Promise<UploadTarget> {
    const { url, expiresAt } = presignS3Url(
      this.options,
      'PUT',
      input.objectKey,
      input.expiresInSeconds,
      this.now(),
    );
    return { uploadUrl: url, objectKey: input.objectKey, expiresAt };
  }

  /**
   * ADR-023 Amendment A: the read half, differing from the write half only in the verb. Both go
   * through the same signer, so a change to the canonicalisation cannot apply to one and not the
   * other — which is the failure a copy-paste would have produced eventually.
   */
  async createDownloadTarget(input: CreateDownloadTargetInput): Promise<DownloadTarget> {
    if (
      !Number.isInteger(input.expiresInSeconds) ||
      input.expiresInSeconds <= 0 ||
      input.expiresInSeconds > DOWNLOAD_URL_TTL_SECONDS
    ) {
      // Refuse rather than clamp: a silently shortened URL is a bug nobody sees, and a silently
      // lengthened one widens the window a leaked URL stays live for.
      throw new DownloadTtlTooLongError(input.expiresInSeconds, DOWNLOAD_URL_TTL_SECONDS);
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

  async delete(objectKey: string): Promise<void> {
    // Best-effort: real deletion of an abandoned upload is out of the MVP's
    // hot path; the metadata row is authoritative. Kept as a no-op seam so a
    // later cleanup job can implement it without changing callers.
    void objectKey;
  }
}
