import {
  apiErrorSchema,
  loginSchema,
  logoutRequestSchema,
  meResponseSchema,
  refreshRequestSchema,
  registerSchema,
  tokenResponseSchema,
} from '@skillswap/contracts';
import type { AuthApiPort } from '@/application/port/auth-api';
import {
  AuthenticationError,
  SessionExpiredRetryRequiredError,
  type LoginCredentials,
  type RawTokenPayload,
  type RegisterCredentials,
  type SessionUser,
} from '@/application/port/session-types';
import type { MobileConfig } from '../config';

export interface SessionTokenProvider {
  getAccessToken(): Promise<string>;
  refreshSession(): Promise<{ tokens: { accessToken: string } } | string>;
}

export interface GatewayRequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
  readonly accessToken?: string;
  readonly idempotencyKey?: string;
}

export interface AuthenticatedGatewayRequestOptions extends GatewayRequestOptions {
  readonly tokenProvider?: SessionTokenProvider;
}

/**
 * Sanitizes credentials, passwords, and tokens so sensitive data is never logged
 * or leaked inside exception messages.
 */
export function sanitizeErrorMessage(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, 'Bearer [REDACTED]')
    .replace(/(["']?password["']?\s*[:=]\s*["'])[^"']+["']/gi, '$1[REDACTED]"')
    .replace(/(["']?refreshToken["']?\s*[:=]\s*["'])[^"']+["']/gi, '$1[REDACTED]"')
    .replace(/(["']?accessToken["']?\s*[:=]\s*["'])[^"']+["']/gi, '$1[REDACTED]"');
}

/**
 * Recursively scrubs error details so passwords, tokens, and authorization secrets
 * are redacted before being stored on error objects.
 */
export function sanitizeErrorDetails(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }
  if (typeof data === 'string') {
    return sanitizeErrorMessage(data);
  }
  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeErrorDetails(item));
  }
  if (typeof data === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (/password|token|secret|authorization|credential|cookie|jwt/i.test(key)) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeErrorDetails(val);
      }
    }
    return sanitizedObj;
  }
  return '[REDACTED]';
}

export class GatewayHttpError extends Error {
  readonly statusCode: number;
  readonly errorDetails?: unknown;
  readonly requiresReconciliation: boolean;

  constructor(
    statusCode: number,
    message: string,
    options?: {
      errorDetails?: unknown;
      requiresReconciliation?: boolean;
    },
  ) {
    super(sanitizeErrorMessage(message));
    this.name = 'GatewayHttpError';
    this.statusCode = statusCode;
    this.errorDetails = sanitizeErrorDetails(options?.errorDetails);
    this.requiresReconciliation = options?.requiresReconciliation ?? false;
  }
}

/**
 * HTTP Gateway client for the mobile client.
 *
 * Implements AuthApiPort and generic REST communication with the Gateway BFF:
 * - Uses @skillswap/contracts schemas for validation and serialization.
 * - Routes all calls strictly through Gateway `/api`.
 * - Injects `fetch` for deterministic unit testing.
 * - Retries eligible GET requests at most once after token refresh on 401.
 * - Never replays POST / financial commands; returns explicit session expired state instead.
 * - Normalizes errors and details without leaking credentials or tokens.
 */
export class GatewayClient implements AuthApiPort {
  private tokenProvider?: SessionTokenProvider;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly config: MobileConfig,
    options?: {
      fetchFn?: typeof fetch;
      tokenProvider?: SessionTokenProvider;
    },
  ) {
    this.fetchFn = options?.fetchFn ?? globalThis.fetch;
    this.tokenProvider = options?.tokenProvider;
  }

  setTokenProvider(provider: SessionTokenProvider): void {
    this.tokenProvider = provider;
  }

  // ==========================================
  // AuthApiPort Implementation
  // ==========================================

  async register(credentials: RegisterCredentials): Promise<RawTokenPayload> {
    const validatedInput = registerSchema.parse({
      email: credentials.email,
      displayName: credentials.displayName,
      password: credentials.password,
      role: credentials.role ?? 'user',
    });

    const response = await this.request<unknown>('/auth/register', {
      method: 'POST',
      body: validatedInput,
    });

    const parsed = tokenResponseSchema.parse(response);

    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresIn: parsed.expiresIn,
      tokenType: parsed.tokenType,
    };
  }

  async login(credentials: LoginCredentials): Promise<RawTokenPayload> {
    const validatedInput = loginSchema.parse({
      email: credentials.email,
      password: credentials.password,
    });

    try {
      const response = await this.request<unknown>('/auth/login', {
        method: 'POST',
        body: validatedInput,
      });

      const parsed = tokenResponseSchema.parse(response);

      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresIn: parsed.expiresIn,
        tokenType: parsed.tokenType,
      };
    } catch (error) {
      if (error instanceof GatewayHttpError && error.statusCode === 401) {
        throw new AuthenticationError(error.message, 401);
      }
      throw error;
    }
  }

  async refresh(refreshToken: string): Promise<RawTokenPayload> {
    const validatedInput = refreshRequestSchema.parse({
      refreshToken,
    });

    try {
      const response = await this.request<unknown>('/auth/refresh', {
        method: 'POST',
        body: validatedInput,
      });

      const parsed = tokenResponseSchema.parse(response);

      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresIn: parsed.expiresIn,
        tokenType: parsed.tokenType,
      };
    } catch (error) {
      if (error instanceof GatewayHttpError && error.statusCode === 401) {
        throw new AuthenticationError('Refresh token expired or revoked', 401);
      }
      throw error;
    }
  }

  async logout(refreshToken: string): Promise<void> {
    const validatedInput = logoutRequestSchema.parse({
      refreshToken,
    });

    await this.request<void>('/auth/logout', {
      method: 'POST',
      body: validatedInput,
    });
  }

  async getMe(accessToken: string): Promise<SessionUser> {
    const response = await this.request<unknown>('/auth/me', {
      method: 'GET',
      accessToken,
    });

    const parsed = meResponseSchema.parse(response);

    return {
      id: parsed.id,
      email: parsed.email,
      displayName: parsed.displayName,
      role: parsed.role,
      status: parsed.status,
      studentVerification: parsed.studentVerification
        ? {
            status: parsed.studentVerification.status,
            reason: parsed.studentVerification.reason,
          }
        : null,
    };
  }

  // ==========================================
  // General & Authenticated HTTP Requests
  // ==========================================

  /**
   * Executes a direct HTTP request to the Gateway BFF.
   */
  async request<T>(path: string, options: GatewayRequestOptions = {}): Promise<T> {
    const url = this.resolveEndpointUrl(path);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers ?? {}),
    };

    if (options.accessToken) {
      headers['Authorization'] = `Bearer ${options.accessToken}`;
    }

    if (options.idempotencyKey) {
      headers['x-idempotency-key'] = options.idempotencyKey;
    }

    let requestBody: string | undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: options.method ?? 'GET',
        headers,
        body: requestBody,
      });
    } catch (networkError) {
      throw new GatewayHttpError(
        0,
        networkError instanceof Error
          ? networkError.message
          : 'Network request failed: Gateway unreachable',
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    try {
      return (await response.json()) as T;
    } catch {
      return undefined as T;
    }
  }

  /**
   * Executes an authenticated request with single-flight refresh coordination.
   *
   * Invariants:
   * - GET requests: on 401, refreshes session and retries AT MOST ONCE.
   * - Non-GET (POST/PUT/etc.) commands: on 401, NEVER automatically replays; throws
   *   SessionExpiredRetryRequiredError so caller safely reconciles with idempotency.
   */
  async authenticatedRequest<T>(
    path: string,
    options: AuthenticatedGatewayRequestOptions = {},
  ): Promise<T> {
    const provider = options.tokenProvider ?? this.tokenProvider;
    if (!provider) {
      throw new GatewayHttpError(
        401,
        'Cannot perform authenticated request without a configured SessionTokenProvider',
      );
    }

    const currentToken = await provider.getAccessToken();
    const method = (options.method ?? 'GET').toUpperCase();

    try {
      return await this.request<T>(path, {
        ...options,
        accessToken: currentToken,
      });
    } catch (error) {
      const isUnauthorized =
        error instanceof GatewayHttpError && error.statusCode === 401;

      if (!isUnauthorized) {
        throw error;
      }

      // Non-GET operations (POST, PUT, DELETE, PATCH): Suppress replay!
      if (method !== 'GET') {
        throw new SessionExpiredRetryRequiredError(
          `Session expired during ${method} command. Automatic replay suppressed; reconcile with idempotency key.`,
        );
      }

      // Eligible GET request: refresh token and retry exactly once
      const refreshed = await provider.refreshSession();
      const freshToken =
        typeof refreshed === 'string'
          ? refreshed
          : refreshed.tokens.accessToken;

      return await this.request<T>(path, {
        ...options,
        accessToken: freshToken,
      });
    }
  }

  // ==========================================
  // Private Helpers
  // ==========================================

  private resolveEndpointUrl(path: string): string {
    const trimmedPath = path.trim().replace(/^\/+/, '');
    const withoutApiPrefix = trimmedPath.startsWith('api/')
      ? trimmedPath.slice(4)
      : trimmedPath;

    return `${this.config.apiBaseUrl}/${withoutApiPrefix}`;
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    let errorDetails: unknown = undefined;

    try {
      const json = await response.json();
      const parsedApiError = apiErrorSchema.safeParse(json);
      if (parsedApiError.success) {
        errorMessage = parsedApiError.data.message;
        errorDetails = parsedApiError.data.error;
      } else if (json && typeof json === 'object') {
        const candidate = json as { message?: unknown; error?: unknown; details?: unknown };
        if (typeof candidate.message === 'string') {
          errorMessage = candidate.message;
        } else if (Array.isArray(candidate.message)) {
          errorMessage = candidate.message.join(', ');
        }
        errorDetails = candidate.error ?? candidate.details ?? json;
      }
    } catch {
      // Non-JSON response (e.g. 502 Bad Gateway HTML)
      if (response.status === 502) {
        errorMessage = 'Upstream API unavailable';
      }
    }

    throw new GatewayHttpError(response.status, errorMessage, {
      errorDetails,
    });
  }
}
