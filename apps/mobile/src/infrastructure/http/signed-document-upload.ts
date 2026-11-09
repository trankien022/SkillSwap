import type { EvidenceDocumentUploadTargetView } from '@skillswap/contracts';
import { sanitizeErrorMessage } from './gateway-client';

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

export async function uploadSignedDocument(targetOrUrl: EvidenceDocumentUploadTargetView | string, bytes: Uint8Array | ArrayBuffer, options?: UploadDocumentOptions, fetchFn: typeof fetch = globalThis.fetch.bind(globalThis)): Promise<void> {
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

        response = await fetchFn(targetOrUrl.uploadUrl, {
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
