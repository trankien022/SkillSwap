export const EVIDENCE_DOCUMENT_STORE = Symbol('EvidenceDocumentStore');

/**
 * FR-003 / ADR-023 (storage half): the object-storage port for certificate evidence.
 *
 * Deliberately a **separate interface from `student-verification`'s `DocumentStore`** even though
 * the shapes match. Sharing the type would mean one module importing another's application port,
 * which ADR-005/ADR-011 forbid; sharing the *implementation* is what matters, and that is the
 * adapter, which both build on `shared/storage/s3-presign.ts`. TypeScript is structural, so the
 * same `S3DocumentStore` class satisfies both interfaces without either knowing the other exists.
 */
export interface EvidenceDocumentStore {
  createUploadTarget(input: {
    readonly objectKey: string;
    readonly contentType: string;
    readonly expiresInSeconds: number;
  }): Promise<{
    readonly uploadUrl: string;
    readonly objectKey: string;
    readonly expiresAt: Date;
  }>;

  /**
   * FR-003: mints the pre-signed GET a Verifier opens. Same 300 s cap and same "never persisted,
   * never logged, never listed" rule as ADR-023 Amendment A — the credential is the URL, and a
   * certificate is somebody's identity document too.
   */
  createDownloadTarget(input: {
    readonly objectKey: string;
    readonly expiresInSeconds: number;
  }): Promise<{
    readonly downloadUrl: string;
    readonly expiresAt: Date;
  }>;
}

/**
 * ADR-023 Amendment A's cap, applied here by inheritance rather than by a new decision: a reviewer
 * opening a certificate and a reviewer opening an enrolment letter are the same act, so the window
 * is the same 300 seconds.
 */
export const EVIDENCE_DOWNLOAD_URL_TTL_SECONDS = 300;

export class EvidenceDownloadTtlTooLongError extends Error {
  constructor(requested: number, max: number) {
    super(`Download URL lifetime ${requested}s exceeds the ${max}s cap`);
    this.name = 'EvidenceDownloadTtlTooLongError';
  }
}
