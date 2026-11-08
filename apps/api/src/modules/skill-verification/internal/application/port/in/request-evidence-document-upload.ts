import type { EvidenceDocumentUploadTargetView } from '@skillswap/contracts';

export const REQUEST_EVIDENCE_DOCUMENT_UPLOAD = Symbol('RequestEvidenceDocumentUpload');

export interface RequestEvidenceDocumentUploadCommand {
  readonly accountId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

/**
 * FR-003: a verified student asks where to put a certificate.
 *
 * The key is built server-side from the caller's account id, so the client never chooses where its
 * file lands and cannot aim an upload at somebody else's prefix.
 */
export interface RequestEvidenceDocumentUploadPort {
  execute(
    command: RequestEvidenceDocumentUploadCommand,
  ): Promise<EvidenceDocumentUploadTargetView>;
}
