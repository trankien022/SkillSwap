import {
  documentUploadRequestSchema,
  documentUploadTargetSchema,
  studentVerificationSchema,
  submitStudentVerificationSchema,
  type DocumentUploadRequestInput,
  type DocumentUploadTargetView,
  type StudentVerificationView,
  type SubmitStudentVerificationInput,
} from '@skillswap/contracts';
import {
  GatewayClient,
  sanitizeErrorMessage,
} from './gateway-client';

export class DocumentUploadError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(sanitizeErrorMessage(message));
    this.name = 'DocumentUploadError';
    this.statusCode = statusCode;
  }
}

export interface UploadDocumentOptions {
  readonly contentType?: string;
  readonly expectedSizeBytes?: number;
  readonly expiresAt?: string | Date;
}

/**
 * The part of a signed upload form `uploadDocument` actually needs. A student-verification target
 * carries a `documentId` on top of this; a certificate target (FR-003) does not, so the shared
 * upload flow must not require it.
 */
export type SignedUploadTarget = Pick<DocumentUploadTargetView, 'uploadUrl' | 'fields' | 'expiresAt'>;

export interface SubmitStudentVerificationWithDocumentInput {
  readonly schoolName: string;
  readonly major?: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: Uint8Array | ArrayBuffer;
}

/**
 * Pure HTTP adapter for student verification in the mobile client.
 *
 * Implements FR-002 / FR-017 / ADR-023:
 * - Uses @skillswap/contracts schemas for validation and serialization.
 * - Delegates all Gateway BFF calls strictly to GatewayClient.authenticatedRequest (sole auth/GET-retry owner).
 * - Direct signed multipart POST of raw bytes (Uint8Array / ArrayBuffer) using injected fetch.
 * - Enforces zero-byte rejection, expected size matching, expiration check, and http/https URL validation.
 * - Strips Gateway tokens and credentials from direct storage requests.
 * - Sanitizes storage error messages so signed fields and signature values never leak.
 * - Never includes administrative approval/rejection endpoints (mobile user client only).
 */
export class StudentVerificationGateway {
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly gatewayClient: GatewayClient,
    options?: {
      fetchFn?: typeof fetch;
    },
  ) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Requests a signed Cloudinary upload target from the Gateway BFF (POST /student-verifications/documents).
   */
  async requestDocumentUpload(
    input: DocumentUploadRequestInput,
  ): Promise<DocumentUploadTargetView> {
    const validatedInput = documentUploadRequestSchema.parse(input);

    const response = await this.gatewayClient.authenticatedRequest<unknown>(
      '/student-verifications/documents',
      {
        method: 'POST',
        body: validatedInput,
      },
    );

    return documentUploadTargetSchema.parse(response);
  }

  /**
   * Direct multipart POST of raw binary bytes to Cloudinary (ADR-038).
   *
   * Invariants:
   * - Caller passes Uint8Array or ArrayBuffer; never JSON serializes or base64 transforms binary.
   * - Every signed field from the target is posted verbatim; the provider re-derives the
   *   signature from what arrives, so a renamed or re-encoded field fails the upload.
   * - Content-Type is left to the runtime: setting it would omit the multipart boundary.
   * - No Gateway Bearer token, x-idempotency-key, or cookies sent to the storage provider.
   * - Validates URL (http: and https: only) and rejects expired, zero or mismatched byte sizes
   *   before issuing the network request.
   * - Throws DocumentUploadError without exposing signed fields or signature values.
   * - Resolves Promise<void> ONLY after storage returns HTTP OK (2xx).
   */
  async uploadDocument(
    targetOrUrl: SignedUploadTarget | string,
    bytes: Uint8Array | ArrayBuffer,
    options?: UploadDocumentOptions,
  ): Promise<void> {
    const uploadUrl = typeof targetOrUrl === 'string' ? targetOrUrl : targetOrUrl.uploadUrl;

    if (!uploadUrl || typeof uploadUrl !== 'string') {
      throw new DocumentUploadError(0, 'Upload rejected: missing upload URL');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(uploadUrl);
    } catch {
      throw new DocumentUploadError(0, 'Upload rejected: invalid upload URL format');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new DocumentUploadError(
        0,
        'Upload rejected: upload URL must use http: or https: protocol',
      );
    }

    const byteLength = bytes.byteLength;

    if (byteLength === 0) {
      throw new DocumentUploadError(
        0,
        'Upload rejected: byte payload cannot be empty (0 bytes)',
      );
    }

    if (options?.expectedSizeBytes !== undefined && byteLength !== options.expectedSizeBytes) {
      throw new DocumentUploadError(
        0,
        `Upload rejected: byte size mismatch (expected ${options.expectedSizeBytes} bytes, got ${byteLength} bytes)`,
      );
    }

    const rawExpiresAt =
      options?.expiresAt ?? (typeof targetOrUrl === 'object' ? targetOrUrl.expiresAt : undefined);
    if (rawExpiresAt) {
      const expiryTime =
        typeof rawExpiresAt === 'string' ? new Date(rawExpiresAt).getTime() : rawExpiresAt.getTime();
      if (Number.isFinite(expiryTime) && Date.now() >= expiryTime) {
        throw new DocumentUploadError(
          0,
          'Upload rejected: signed upload target has expired',
        );
      }
    }

    const isTarget = typeof targetOrUrl !== 'string';

    const headers: Record<string, string> = {};
    // Content-Type is deliberately omitted: the runtime must add the multipart boundary itself.
    // A caller-supplied content type would strip it and the provider would see a malformed body.

    let response: Response;
    try {
      if (isTarget) {
        // ADR-038: the provider authenticates from signed fields in the body, not from the URL.
        // Every field must be posted verbatim — the signature is recomputed over what arrives.
        const form = new FormData();
        for (const [key, value] of Object.entries(targetOrUrl.fields)) {
          form.append(key, value);
        }
        form.append(
          'file',
          new Blob([bytes instanceof ArrayBuffer ? bytes : (new Uint8Array(bytes).buffer as ArrayBuffer)], {
            type: options?.contentType ?? 'application/octet-stream',
          }),
          'document',
        );

        response = await this.fetchFn(targetOrUrl.uploadUrl, {
          method: 'POST',
          credentials: 'omit',
          headers,
          body: form,
        });
      } else {
        // A bare URL carries no credentials, so there is nothing to sign. Kept only so the
        // string overload fails with a clear message rather than an opaque 401 at the provider.
        throw new DocumentUploadError(
          0,
          'Upload rejected: a signed upload target is required (Cloudinary authenticates by body fields)',
        );
      }
    } catch (err) {
      if (err instanceof DocumentUploadError) {
        throw err;
      }
      throw new DocumentUploadError(
        0,
        'Document storage upload failed: storage service unreachable',
      );
    }

    if (!response.ok) {
      throw new DocumentUploadError(
        response.status,
        `Document storage upload failed with HTTP status ${response.status}`,
      );
    }
  }

  /**
   * Submits a student verification metadata record (POST /student-verifications).
   */
  async submitVerification(
    input: SubmitStudentVerificationInput,
  ): Promise<StudentVerificationView> {
    const validatedInput = submitStudentVerificationSchema.parse(input);

    const response = await this.gatewayClient.authenticatedRequest<unknown>(
      '/student-verifications',
      {
        method: 'POST',
        body: validatedInput,
      },
    );

    return studentVerificationSchema.parse(response);
  }

  /**
   * Reads the caller's own latest student verification record (GET /student-verifications/me).
   * Returns null if the caller has never submitted a verification.
   */
  async getMyVerification(): Promise<StudentVerificationView | null> {
    const response = await this.gatewayClient.authenticatedRequest<unknown>(
      '/student-verifications/me',
      {
        method: 'GET',
      },
    );

    return studentVerificationSchema.nullable().parse(response);
  }

  /**
   * Complete multi-step student verification submission:
   * 1. Request a signed upload target.
   * 2. Direct upload document bytes to storage.
   * 3. Submit verification metadata linking the uploaded documentId.
   *
   * Invariant: If the storage upload fails, submitVerification is NEVER invoked.
   */
  async submitWithDocument(
    input: SubmitStudentVerificationWithDocumentInput,
  ): Promise<StudentVerificationView> {
    const byteLength = input.bytes.byteLength;

    const target = await this.requestDocumentUpload({
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: byteLength,
    });

    await this.uploadDocument(target, input.bytes, {
      contentType: input.contentType,
      expectedSizeBytes: byteLength,
      expiresAt: target.expiresAt,
    });

    return await this.submitVerification({
      schoolName: input.schoolName,
      major: input.major,
      documentId: target.documentId,
    });
  }
}
