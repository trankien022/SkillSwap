import type { DocumentUploadTargetView } from '@skillswap/contracts';

export const REQUEST_DOCUMENT_UPLOAD = Symbol('RequestDocumentUpload');

/** FR-002 / API-001: a Learner asks for a pre-signed URL to upload a document. */
export interface RequestDocumentUploadCommand {
  accountId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface RequestDocumentUploadPort {
  execute(command: RequestDocumentUploadCommand): Promise<DocumentUploadTargetView>;
}
