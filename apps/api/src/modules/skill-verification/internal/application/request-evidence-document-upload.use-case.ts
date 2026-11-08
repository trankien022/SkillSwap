import { randomUUID } from 'node:crypto';
import type { EvidenceDocumentUploadTargetView } from '@skillswap/contracts';
import {
  assertEvidenceUploadable,
  buildEvidenceObjectKey,
  type EvidenceUploadPolicy,
} from '../domain/evidence-document';
import type { EvidenceDocumentStore } from './port/out/evidence-document-store';
import type {
  RequestEvidenceDocumentUploadCommand,
  RequestEvidenceDocumentUploadPort,
} from './port/in/request-evidence-document-upload';

/**
 * FR-003 / ADR-038 (storage half): validates the declared file against the policy and returns a
 * signed multipart form. Bytes go client → store and never touch the API, so there is nothing to
 * log.
 *
 * The upload TTL is deliberately the *same* config value `student-verification` uses. A certificate
 * is not a bigger file than an enrolment letter, so a longer window would only widen the period an
 * upload URL works for no benefit.
 */
export class RequestEvidenceDocumentUploadUseCase implements RequestEvidenceDocumentUploadPort {
  constructor(
    private readonly store: EvidenceDocumentStore,
    private readonly policy: EvidenceUploadPolicy,
    private readonly uploadTtlSeconds: number,
  ) {}

  async execute(
    command: RequestEvidenceDocumentUploadCommand,
  ): Promise<EvidenceDocumentUploadTargetView> {
    assertEvidenceUploadable(command, this.policy);

    const documentId = randomUUID();
    const objectKey = buildEvidenceObjectKey({
      accountId: command.accountId,
      documentId,
      fileName: command.fileName,
    });

    const target = await this.store.createUploadTarget({
      objectKey,
      contentType: command.contentType,
      expiresInSeconds: this.uploadTtlSeconds,
    });

    return {
      uploadUrl: target.uploadUrl,
      method: target.method,
      fields: target.fields,
      objectKey: target.objectKey,
      expiresAt: target.expiresAt.toISOString(),
    };
  }
}
