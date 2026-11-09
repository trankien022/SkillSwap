import {
  evidenceDocumentUploadRequestSchema,
  evidenceDocumentUploadTargetSchema,
  documentDownloadTargetSchema,
  profileSkillListSchema,
  skillEvidenceHistorySchema,
  skillEvidenceViewSchema,
  submitSkillEvidenceSchema,
  type EvidenceDocumentUploadRequestInput,
  type EvidenceDocumentUploadTargetView,
  type ProfileSkillView,
  type SkillEvidenceHistoryView,
  type SkillEvidenceView,
  type SkillLevel,
  type SubmitSkillEvidenceInput,
} from '@skillswap/contracts';
import { GatewayClient } from './gateway-client';
import { StudentVerificationGateway } from './student-verification-gateway';

export interface SubmitCertificateEvidenceInput {
  readonly skillId: string;
  readonly requestedLevel: SkillLevel;
  readonly description?: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: Uint8Array | ArrayBuffer;
}

/**
 * Pure HTTP adapter for skill evidence and profile skills in the mobile client.
 *
 * Implements FR-003 / FR-018 / ADR-026 / ADR-028 / ADR-038:
 * - Uses @skillswap/contracts schemas for validation and serialization.
 * - Routes all calls strictly through GatewayClient.authenticatedRequest (sole auth/GET-retry owner).
 * - Never auto-replays POST commands on 401.
 * - Certificate evidence (B9) reuses the student-verification upload flow: request a signed form
 *   (`POST /skill-evidence/documents`), post the bytes with `StudentVerificationGateway.uploadDocument`,
 *   then submit with the returned `objectKey` as `documentRef`. No upload code is duplicated here.
 * - Rejects empty evidence IDs locally and URI-encodes URL path parameters.
 * - Enforces static 4-level skill hierarchy from contracts (beginner, intermediate, advanced, expert).
 * - Preserves server-authoritative evidence statuses and decision histories without premature client approval.
 * - Never loads another user's private evidence profile (owner /me queries only).
 */
export class SkillEvidenceGateway {
  constructor(
    private readonly gatewayClient: GatewayClient,
    private readonly options?: { fetchFn?: typeof fetch },
  ) {}

  /**
   * Requests a signed upload form for certificate evidence (POST /skill-evidence/documents).
   */
  async requestDocumentUpload(
    input: EvidenceDocumentUploadRequestInput,
  ): Promise<EvidenceDocumentUploadTargetView> {
    const validatedInput = evidenceDocumentUploadRequestSchema.parse(input);

    const response = await this.gatewayClient.authenticatedRequest<unknown>(
      '/skill-evidence/documents',
      {
        method: 'POST',
        body: validatedInput,
      },
    );

    return evidenceDocumentUploadTargetSchema.parse(response);
  }

  /**
   * Certificate submission: request target → upload bytes → submit with `documentRef`.
   *
   * Invariant: if the storage upload fails, the evidence is NEVER submitted.
   */
  async submitCertificateEvidence(
    input: SubmitCertificateEvidenceInput,
  ): Promise<SkillEvidenceView> {
    const byteLength = input.bytes.byteLength;

    const target = await this.requestDocumentUpload({
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: byteLength,
    });

    await new StudentVerificationGateway(this.gatewayClient, this.options).uploadDocument(
      target,
      input.bytes,
      {
        contentType: input.contentType,
        expectedSizeBytes: byteLength,
        expiresAt: target.expiresAt,
      },
    );

    return this.submitSkillEvidence({
      skillId: input.skillId,
      requestedLevel: input.requestedLevel,
      evidenceType: 'certificate',
      documentRef: target.objectKey,
      ...(input.description ? { description: input.description } : {}),
    });
  }

  async readDocument(evidenceId: string) {
    if (!evidenceId.trim()) throw new Error('Evidence ID cannot be empty');
    return documentDownloadTargetSchema.parse(await this.gatewayClient.authenticatedRequest<unknown>(
      `/skill-evidence/${encodeURIComponent(evidenceId.trim())}/document`,
      { method: 'GET' },
    ));
  }
  /**
   * Submits skill evidence for a known skill at a requested level (POST /skill-evidence).
   *
   * Validates input with submitSkillEvidenceSchema before sending to the network.
   * Validates server response with skillEvidenceViewSchema.
   */
  async submitSkillEvidence(
    input: SubmitSkillEvidenceInput,
  ): Promise<SkillEvidenceView> {
    const validatedInput = submitSkillEvidenceSchema.parse(input);

    const response = await this.gatewayClient.authenticatedRequest<unknown>(
      '/skill-evidence',
      {
        method: 'POST',
        body: validatedInput,
      },
    );

    return skillEvidenceViewSchema.parse(response);
  }

  /**
   * Reads the caller's own profile skills and approved levels (GET /profile-skills/me).
   *
   * Never loads another user's profile.
   * Validates the backend collection contract and returns its items.
   */
  async getMyProfileSkills(): Promise<ProfileSkillView[]> {
    const response = await this.gatewayClient.authenticatedRequest<unknown>(
      '/profile-skills/me',
      {
        method: 'GET',
      },
    );

    return profileSkillListSchema.parse(response).items;
  }

  /**
   * Reads the decision history and audit trail for a profile-skill's evidence (GET /skill-evidence/:id/history).
   *
   * Rejects empty IDs locally before making a network call.
   * Encodes the identifier using encodeURIComponent.
   * Validates server response with skillEvidenceHistorySchema.
   */
  async getSkillEvidenceHistory(
    evidenceId: string,
  ): Promise<SkillEvidenceHistoryView> {
    if (!evidenceId || !evidenceId.trim()) {
      throw new Error('Evidence ID cannot be empty');
    }

    const trimmedId = evidenceId.trim();
    const encodedId = encodeURIComponent(trimmedId);

    const response = await this.gatewayClient.authenticatedRequest<unknown>(
      `/skill-evidence/${encodedId}/history`,
      {
        method: 'GET',
      },
    );

    return skillEvidenceHistorySchema.parse(response);
  }
}
