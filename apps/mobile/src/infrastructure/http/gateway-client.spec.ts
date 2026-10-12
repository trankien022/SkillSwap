import {
  AuthenticationError,
  SessionExpiredRetryRequiredError,
} from '@/application/port/session-types';
import type { MobileConfig } from '../config';
import {
  GatewayClient,
  GatewayHttpError,
  sanitizeErrorMessage,
  type SessionTokenProvider,
} from './gateway-client';

describe('GatewayClient', () => {
  const config: MobileConfig = {
    gatewayBaseUrl: 'http://localhost:4000',
    apiBaseUrl: 'http://localhost:4000/api',
  };

  const sampleTokenResponse = {
    accessToken: 'fresh-access-token',
    refreshToken: 'fresh-refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer',
  };

  const sampleMeResponse = {
    id: 'user-456',
    email: 'user@skillswap.edu.vn',
    displayName: 'Student One',
    role: 'user',
    status: 'active',
    studentVerification: {
      status: 'approved',
      reason: null,
    },
  };

  describe('Authentication Endpoints', () => {
    it('registers user and validates TokenResponse schema', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleTokenResponse,
      });

      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      const result = await client.register({
        email: 'new@example.com',
        displayName: 'New User',
        password: 'password123',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:4000/api/auth/register');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({
        email: 'new@example.com',
        displayName: 'New User',
        password: 'password123',
        role: 'user',
      });
      expect(result).toEqual(sampleTokenResponse);
    });

    it('logs in user and parses tokens', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleTokenResponse,
      });

      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      const result = await client.login({
        email: 'test@example.com',
        password: 'mypassword',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@example.com', password: 'mypassword' }),
        }),
      );
      expect(result).toEqual(sampleTokenResponse);
    });

    it('maps 401 login failure to AuthenticationError', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          statusCode: 401,
          message: 'Invalid credentials',
        }),
      });

      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      await expect(
        client.login({
          email: 'wrong@example.com',
          password: 'badpassword',
        }),
      ).rejects.toThrow(AuthenticationError);
    });

    it('rotates refresh token via /api/auth/refresh', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleTokenResponse,
      });

      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      const result = await client.refresh('old-refresh-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/auth/refresh',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'old-refresh-token' }),
        }),
      );
      expect(result).toEqual(sampleTokenResponse);
    });

    it('revokes session via /api/auth/logout', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
      });

      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      await client.logout('revoke-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/auth/logout',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ refreshToken: 'revoke-token' }),
        }),
      );
    });

    it('fetches current account profile via /api/auth/me with Bearer token', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => sampleMeResponse,
      });

      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      const profile = await client.getMe('valid-access-token');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/auth/me',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer valid-access-token',
          }),
        }),
      );
      expect(profile).toEqual(sampleMeResponse);
    });
  });

  describe('response envelope compatibility', () => {
    it('unwraps the current API success envelope and returns its bare data', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          code: 'AUTH_LOGIN_OK',
          message: 'Signed in',
          data: sampleTokenResponse,
          errors: [],
        }),
      });
      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      await expect(client.request('/auth/login', { method: 'POST', body: {} })).resolves.toEqual(sampleTokenResponse);
    });

    it('preserves the response envelope code and message for API failures', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          success: false,
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
          data: null,
          errors: [{ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' }],
        }),
      });
      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      await expect(client.request('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
        name: 'GatewayHttpError',
        statusCode: 401,
        message: 'Invalid credentials',
        errorDetails: {
          code: 'INVALID_CREDENTIALS',
        },
      });
    });
  });

  describe('Error Normalization and Security', () => {
    it('normalizes ApiError response extracting statusCode and message', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({
          statusCode: 403,
          message: 'Account suspended',
          error: 'ACCOUNT_SUSPENDED',
        }),
      });

      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      await expect(client.request('/classes')).rejects.toMatchObject({
        name: 'GatewayHttpError',
        statusCode: 403,
        message: 'Account suspended',
      });
    });

    it('sanitizes credentials, bearer tokens, and passwords from error messages', () => {
      const messageWithSecrets =
        'Failed request with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test and "password": "supersecretpassword" and refreshToken="my_secret_token"';
      const sanitized = sanitizeErrorMessage(messageWithSecrets);

      expect(sanitized).not.toContain('supersecretpassword');
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9.test');
      expect(sanitized).not.toContain('my_secret_token');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('sanitizes sensitive keys and token values in errorDetails', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          statusCode: 400,
          message: 'Validation failed for request',
          error: {
            password: 'raw_password_to_redact',
            refreshToken: 'refresh_to_redact',
            nested: {
              secretToken: 'jwt_secret_value',
              detail: 'Authorization: Bearer leaking_token',
            },
            publicField: 'safe_info',
          },
        }),
      });

      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      let caughtError: unknown;
      try {
        await client.request('/auth/register', { method: 'POST', body: {} });
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(GatewayHttpError);
      const httpErr = caughtError as GatewayHttpError;
      const details = httpErr.errorDetails as Record<string, unknown>;

      expect(details.password).toBe('[REDACTED]');
      expect(details.refreshToken).toBe('[REDACTED]');
      expect(details.publicField).toBe('safe_info');

      const serialized = JSON.stringify(details);
      expect(serialized).not.toContain('raw_password_to_redact');
      expect(serialized).not.toContain('refresh_to_redact');
      expect(serialized).not.toContain('jwt_secret_value');
      expect(serialized).not.toContain('leaking_token');
      expect(serialized).toContain('[REDACTED]');
    });

    it('normalizes network disconnects without throwing raw unhandled exceptions', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const client = new GatewayClient(config, { fetchFn: mockFetch as unknown as typeof fetch });

      await expect(client.request('/auth/me')).rejects.toMatchObject({
        name: 'GatewayHttpError',
        statusCode: 0,
        message: 'Failed to fetch',
      });
    });
  });

  describe('Single-Flight Refresh and Authenticated Request Replay Invariants', () => {
    let mockTokenProvider: jest.Mocked<SessionTokenProvider>;

    beforeEach(() => {
      mockTokenProvider = {
        getAccessToken: jest.fn().mockResolvedValue('initial-access-token'),
        refreshSession: jest.fn().mockResolvedValue({
          tokens: { accessToken: 'rotated-access-token' },
        }),
      };
    });

    it('retries eligible GET request at most once after 401 token refresh', async () => {
      const mockFetch = jest
        .fn()
        // First GET call: fails with 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({ statusCode: 401, message: 'Token expired' }),
        })
        // Second GET call (retry): succeeds with 200
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ data: 'secret-content' }),
        });

      const client = new GatewayClient(config, {
        fetchFn: mockFetch as unknown as typeof fetch,
        tokenProvider: mockTokenProvider,
      });

      const result = await client.authenticatedRequest<{ data: string }>('/classes', {
        method: 'GET',
      });

      expect(result).toEqual({ data: 'secret-content' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockTokenProvider.refreshSession).toHaveBeenCalledTimes(1);

      // Verify the retry used the rotated token
      const secondCallInit = mockFetch.mock.calls[1][1];
      expect(secondCallInit.headers['Authorization']).toBe('Bearer rotated-access-token');
    });

    it('fails eligible GET without looping if retry also returns 401 (one retry max)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ statusCode: 401, message: 'Token permanently revoked' }),
      });

      const client = new GatewayClient(config, {
        fetchFn: mockFetch as unknown as typeof fetch,
        tokenProvider: mockTokenProvider,
      });

      await expect(
        client.authenticatedRequest('/classes', { method: 'GET' }),
      ).rejects.toMatchObject({
        statusCode: 401,
      });

      // Exactly 2 attempts: initial + 1 retry max
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockTokenProvider.refreshSession).toHaveBeenCalledTimes(1);
    });

    it('NEVER automatically replays POST / financial commands on 401 and returns explicit retry state', async () => {
      const mockFetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ statusCode: 401, message: 'Token expired' }),
      });

      const client = new GatewayClient(config, {
        fetchFn: mockFetch as unknown as typeof fetch,
        tokenProvider: mockTokenProvider,
      });

      const postPromise = client.authenticatedRequest('/classes/123/bookings', {
        method: 'POST',
        body: { idempotencyKey: 'idempotent-key-1' },
      });

      await expect(postPromise).rejects.toThrow(SessionExpiredRetryRequiredError);
      await expect(postPromise).rejects.toMatchObject({
        requiresReconciliation: true,
        code: 'SESSION_EXPIRED_RETRY_REQUIRED',
      });

      // Crucial verification: POST was dispatched EXACTLY once, never re-sent!
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
