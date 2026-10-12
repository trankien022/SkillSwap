import {
  SessionExpiredRetryRequiredError,
} from '@/application/port/session-types';
import type { MobileConfig } from '../config';
import {
  GatewayClient,
  type SessionTokenProvider,
} from './gateway-client';
import {
  DocumentUploadError,
  StudentVerificationGateway,
} from './student-verification-gateway';

describe('StudentVerificationGateway', () => {
  const config: MobileConfig = {
    gatewayBaseUrl: 'http://localhost:4000',
    apiBaseUrl: 'http://localhost:4000/api',
  };

  const sampleTarget = {
    documentId: 'doc-123',
    uploadUrl: 'http://storage.local/upload/doc-123?X-Amz-Signature=secretSig123',
    objectKey: 'students/doc-123.pdf',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };

  const sampleVerification = {
    id: 'ver-456',
    status: 'pending',
    schoolName: 'HCMUT',
    major: 'Computer Science',
    reviewerId: null,
    reason: null,
    decidedAt: null,
    submittedAt: '2026-10-12T02:00:00.000Z',
  };

  let mockGatewayFetch: jest.Mock;
  let mockStorageFetch: jest.Mock;
  let mockTokenProvider: jest.Mocked<SessionTokenProvider>;
  let gatewayClient: GatewayClient;
  let gateway: StudentVerificationGateway;

  beforeEach(() => {
    mockGatewayFetch = jest.fn();
    mockStorageFetch = jest.fn();
    mockTokenProvider = {
      getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
      refreshSession: jest.fn().mockResolvedValue({
        tokens: { accessToken: 'refreshed-access-token' },
      }),
    };

    gatewayClient = new GatewayClient(config, {
      fetchFn: mockGatewayFetch as unknown as typeof fetch,
      tokenProvider: mockTokenProvider,
    });

    gateway = new StudentVerificationGateway(gatewayClient, {
      fetchFn: mockStorageFetch as unknown as typeof fetch,
    });
  });

  describe('requestDocumentUpload', () => {
    it('sends POST to exact /student-verifications/documents path and validates response', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleTarget,
      });

      const result = await gateway.requestDocumentUpload({
        fileName: 'student-card.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
      });

      expect(mockGatewayFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockGatewayFetch.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/student-verifications/documents');
      expect(init.method).toBe('POST');
      expect(init.headers['Authorization']).toBe('Bearer test-access-token');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(init.body)).toEqual({
        fileName: 'student-card.pdf',
        contentType: 'application/pdf',
        sizeBytes: 2048,
      });
      expect(result).toEqual(sampleTarget);
    });

    it('rejects with ZodError when server returns malformed target response without importing zod', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          documentId: '', // invalid: min(1) required
          uploadUrl: 'http://example.com',
        }),
      });

      let caughtError: unknown;
      try {
        await gateway.requestDocumentUpload({
          fileName: 'student-card.pdf',
          contentType: 'application/pdf',
          sizeBytes: 1024,
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect((caughtError as Error).name).toBe('ZodError');
    });

    it('validates input before sending to network and rejects with ZodError', async () => {
      let caughtError: unknown;
      try {
        await gateway.requestDocumentUpload({
          fileName: '', // invalid: min(1)
          contentType: 'application/pdf',
          sizeBytes: -5, // invalid: positive integer
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect((caughtError as Error).name).toBe('ZodError');
      expect(mockGatewayFetch).not.toHaveBeenCalled();
    });
  });

  describe('uploadDocument', () => {
    const rawBytes = new Uint8Array([99, 1, 2, 3, 4, 5, 6, 7, 8, 99]).subarray(1, 9);

    it('proves byte body, exact Content-Type, and NO Authorization / idempotency headers', async () => {
      mockStorageFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      await gateway.uploadDocument(sampleTarget, rawBytes, {
        contentType: 'application/pdf',
        expectedSizeBytes: 8,
      });

      expect(mockStorageFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockStorageFetch.mock.calls[0];
      expect(url).toBe(sampleTarget.uploadUrl);
      expect(init.method).toBe('PUT');
      expect(init.credentials).toBe('omit');
      expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(rawBytes); // Exact bytes, including subarray boundaries.
      expect(init.headers['Content-Type']).toBe('application/pdf');
      expect(init.headers['Authorization']).toBeUndefined();
      expect(init.headers['authorization']).toBeUndefined();
      expect(init.headers['x-idempotency-key']).toBeUndefined();
      expect(init.headers['cookie']).toBeUndefined();
    });

    it('accepts ArrayBuffer and uploads original bytes directly', async () => {
      mockStorageFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const buffer = new ArrayBuffer(16);
      await gateway.uploadDocument(sampleTarget.uploadUrl, buffer, {
        contentType: 'image/png',
      });

      expect(mockStorageFetch).toHaveBeenCalledTimes(1);
      const [, init] = mockStorageFetch.mock.calls[0];
      expect(init.body).toBe(buffer);
      expect(init.headers['Content-Type']).toBe('image/png');
    });

    it('rejects invalid storage URLs (non-http/https protocol)', async () => {
      await expect(
        gateway.uploadDocument('ftp://storage.local/upload/doc-1', rawBytes),
      ).rejects.toThrow(DocumentUploadError);

      await expect(
        gateway.uploadDocument('javascript:alert(1)', rawBytes),
      ).rejects.toThrow(DocumentUploadError);

      await expect(
        gateway.uploadDocument('invalid-url-format', rawBytes),
      ).rejects.toThrow(DocumentUploadError);

      expect(mockStorageFetch).not.toHaveBeenCalled();
    });

    it('rejects zero-byte payloads before sending', async () => {
      const emptyBytes = new Uint8Array(0);

      await expect(
        gateway.uploadDocument(sampleTarget, emptyBytes),
      ).rejects.toMatchObject({
        name: 'DocumentUploadError',
        message: expect.stringContaining('cannot be empty (0 bytes)'),
      });

      expect(mockStorageFetch).not.toHaveBeenCalled();
    });

    it('rejects mismatched byte sizes before sending', async () => {
      await expect(
        gateway.uploadDocument(sampleTarget, rawBytes, { expectedSizeBytes: 1024 }),
      ).rejects.toMatchObject({
        name: 'DocumentUploadError',
        message: expect.stringContaining('byte size mismatch'),
      });

      expect(mockStorageFetch).not.toHaveBeenCalled();
    });

    it('rejects expired pre-signed upload targets before sending', async () => {
      const expiredTarget = {
        ...sampleTarget,
        expiresAt: new Date(Date.now() - 60000).toISOString(),
      };

      await expect(
        gateway.uploadDocument(expiredTarget, rawBytes),
      ).rejects.toMatchObject({
        name: 'DocumentUploadError',
        message: expect.stringContaining('pre-signed upload target has expired'),
      });

      expect(mockStorageFetch).not.toHaveBeenCalled();
    });

    it('sanitizes error message on failed storage PUT without leaking pre-signed signatures', async () => {
      mockStorageFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      let caughtError: unknown;
      try {
        await gateway.uploadDocument(sampleTarget, rawBytes);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(DocumentUploadError);
      const uploadError = caughtError as DocumentUploadError;
      expect(uploadError.statusCode).toBe(403);
      expect(uploadError.message).not.toContain('secretSig123');
      expect(uploadError.message).not.toContain('X-Amz-Signature');
    });

    it('handles network failure during storage upload with sanitized error', async () => {
      mockStorageFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(
        gateway.uploadDocument(sampleTarget, rawBytes),
      ).rejects.toMatchObject({
        name: 'DocumentUploadError',
        statusCode: 0,
        message: 'Document storage upload failed: storage service unreachable',
      });
    });
  });

  describe('submitVerification', () => {
    it('sends POST to /student-verifications with exact input and parses response', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleVerification,
      });

      const result = await gateway.submitVerification({
        schoolName: 'HCMUT',
        major: 'Computer Science',
        documentId: 'doc-123',
      });

      expect(mockGatewayFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockGatewayFetch.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/student-verifications');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        schoolName: 'HCMUT',
        major: 'Computer Science',
        documentId: 'doc-123',
      });
      expect(result).toEqual(sampleVerification);
    });

    it('validates submission body before sending and rejects with ZodError on empty schoolName', async () => {
      let caughtError: unknown;
      try {
        await gateway.submitVerification({
          schoolName: '',
          documentId: 'doc-123',
        });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeDefined();
      expect((caughtError as Error).name).toBe('ZodError');
      expect(mockGatewayFetch).not.toHaveBeenCalled();
    });
  });

  describe('getMyVerification (nullable me)', () => {
    it('reads /student-verifications/me and returns verification object when present', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleVerification,
      });

      const result = await gateway.getMyVerification();

      expect(mockGatewayFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/student-verifications/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        }),
      );
      expect(result).toEqual(sampleVerification);
    });

    it('reads /student-verifications/me and returns null when caller has no verification', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => null,
      });

      const result = await gateway.getMyVerification();
      expect(result).toBeNull();
    });
  });

  describe('submitWithDocument multi-step flow', () => {
    it('completes requestDocumentUpload -> uploadDocument -> submitVerification sequentially', async () => {
      const rawBytes = new Uint8Array([10, 20, 30, 40]);

      // Step 1: Gateway target request
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleTarget,
      });

      // Step 2: Storage PUT upload
      mockStorageFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      // Step 3: Gateway submission
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleVerification,
      });

      const result = await gateway.submitWithDocument({
        schoolName: 'HCMUT',
        major: 'Computer Science',
        fileName: 'card.pdf',
        contentType: 'application/pdf',
        bytes: rawBytes,
      });

      expect(mockGatewayFetch).toHaveBeenCalledTimes(2);
      expect(mockStorageFetch).toHaveBeenCalledTimes(1);

      expect(mockGatewayFetch.mock.calls[0][0]).toBe(
        'http://localhost:4000/api/student-verifications/documents',
      );
      expect(mockStorageFetch.mock.calls[0][0]).toBe(sampleTarget.uploadUrl);
      expect(mockGatewayFetch.mock.calls[1][0]).toBe(
        'http://localhost:4000/api/student-verifications',
      );

      expect(result).toEqual(sampleVerification);
    });

    it('failed PUT rejects and DOES NOT call submitVerification', async () => {
      const rawBytes = new Uint8Array([10, 20, 30, 40]);

      // Step 1: Gateway target request succeeds
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleTarget,
      });

      // Step 2: Storage PUT upload FAILS
      mockStorageFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Storage Error',
      });

      await expect(
        gateway.submitWithDocument({
          schoolName: 'HCMUT',
          fileName: 'card.pdf',
          contentType: 'application/pdf',
          bytes: rawBytes,
        }),
      ).rejects.toThrow(DocumentUploadError);

      // Verify Step 3 (POST /student-verifications) was NEVER called!
      expect(mockGatewayFetch).toHaveBeenCalledTimes(1);
      expect(mockGatewayFetch.mock.calls[0][0]).toBe(
        'http://localhost:4000/api/student-verifications/documents',
      );
    });
  });

  describe('Session Expiration & Single-Flight Retry Invariants', () => {
    it('POST 401: suppresses automatic replay and throws SessionExpiredRetryRequiredError', async () => {
      mockGatewayFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ statusCode: 401, message: 'Token expired' }),
      });

      await expect(
        gateway.submitVerification({
          schoolName: 'HCMUT',
          documentId: 'doc-123',
        }),
      ).rejects.toThrow(SessionExpiredRetryRequiredError);

      // POST was dispatched exactly once; refresh was not triggered for auto-replay
      expect(mockGatewayFetch).toHaveBeenCalledTimes(1);
      expect(mockTokenProvider.refreshSession).not.toHaveBeenCalled();
    });

    it('GET 401: retries exactly once with refreshed session token through real GatewayClient', async () => {
      // First GET attempt fails 401
      mockGatewayFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ statusCode: 401, message: 'Token expired' }),
      });

      // Second GET attempt (retry) succeeds 200
      mockGatewayFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => sampleVerification,
      });

      const result = await gateway.getMyVerification();

      expect(mockGatewayFetch).toHaveBeenCalledTimes(2);
      expect(mockTokenProvider.refreshSession).toHaveBeenCalledTimes(1);

      // Verify the retry used the refreshed access token
      const retryInit = mockGatewayFetch.mock.calls[1][1];
      expect(retryInit.headers['Authorization']).toBe('Bearer refreshed-access-token');
      expect(result).toEqual(sampleVerification);
    });
  });
});
