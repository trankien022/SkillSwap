import { randomUUID } from 'node:crypto';
import type { DocumentUploadTargetView } from '@skillswap/contracts';
import { assertUploadable, buildObjectKey } from '../domain/document-upload';
import type { DocumentStore } from './port/out/document-store';
import type { VerificationDocumentRepository } from './port/out/verification-document-repository';
import type {
  RequestDocumentUploadCommand,
  RequestDocumentUploadPort,
} from './port/in/request-document-upload';

/**
 * FR-002 / ADR-023 (developer decision 4): validates the declared file against
 * the policy (type/size — NFR-008), records the metadata row in Postgres and
 * returns a pre-signed S3 URL. Bytes never touch the API (nothing to log).
 */
export class RequestDocumentUploadUseCase implements RequestDocumentUploadPort {
  constructor(
    private readonly documents: VerificationDocumentRepository,
    private readonly store: DocumentStore,
    private readonly policy: { allowedContentTypes: readonly string[]; maxBytes: number },
    private readonly uploadTtlSeconds: number,
  ) {}

  async execute(command: RequestDocumentUploadCommand): Promise<DocumentUploadTargetView> {
    assertUploadable(
      { fileName: command.fileName, contentType: command.contentType, sizeBytes: command.sizeBytes },
      this.policy,
    );

    const documentId = randomUUID();
    const objectKey = buildObjectKey({
      accountId: command.accountId,
      documentId,
      fileName: command.fileName,
    });

    const target = await this.store.createUploadTarget({
      objectKey,
      contentType: command.contentType,
      expiresInSeconds: this.uploadTtlSeconds,
    });

    await this.documents.create({
      id: documentId,
      accountId: command.accountId,
      objectKey: target.objectKey,
      fileName: command.fileName,
      contentType: command.contentType,
      sizeBytes: command.sizeBytes,
    });

    return {
      documentId,
      uploadUrl: target.uploadUrl,
      objectKey: target.objectKey,
      expiresAt: target.expiresAt.toISOString(),
    };
  }
}
