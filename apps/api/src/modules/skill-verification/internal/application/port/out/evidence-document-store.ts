export const EVIDENCE_DOCUMENT_STORE = Symbol('EvidenceDocumentStore');

/**
 * FR-003 / ADR-023 (storage half): the object-storage port for certificate evidence.
 *
 * Deliberately a **separate interface from `student-verification`'s `DocumentStore`** even though
 * the shapes match. Sharing the type would mean one module importing another's application port,
 * which ADR-005/ADR-011 forbid; sharing the *implementation* is what matters, and that is the
 * adapter, which both build on `shared/storage/cloudinary-sign.ts`. TypeScript is structural, so
 * the same `CloudinaryDocumentStore` class satisfies both interfaces without either knowing the
 * other exists.
 */
export interface EvidenceDocumentStore {
  /**
   * ADR-038: a certificate goes to Cloudinary as a signed multipart form — an endpoint plus the
   * exact field map a client re-posts — not a pre-signed URL. Every field must be sent verbatim;
   * Cloudinary re-derives the signature from what it receives and rejects any divergence.
   */
  createUploadTarget(input: {
    readonly objectKey: string;
    readonly contentType: string;
    readonly expiresInSeconds: number;
  }): Promise<{
    /** Endpoint the multipart body is posted to. */
    readonly uploadUrl: string;
    /** Always `POST`: the provider authenticates via signed body fields, not a URL signature. */
    readonly method: 'POST';
    /** Signed credential fields, sent unchanged and un-encoded next to the file part. */
    readonly fields: Record<string, string>;
    /** The provider's id for the asset; this is the reference stored as `documentRef`. */
    readonly objectKey: string;
    /** Advisory only: Cloudinary does not enforce the upload window (ADR-038 consequence 2). */
    readonly expiresAt: Date;
  }>;

  /**
   * FR-003: mints the short-lived download URL a reviewer opens. Same 300 s cap and same "never
   * persisted, never logged, never listed" rule as ADR-023 Amendment A — the credential is the URL,
   * and a certificate is somebody's identity document too.
   *
   * The window is enforced by the provider, not merely reported: the expiry is part of the signed
   * request, so it cannot be widened by editing the URL.
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
