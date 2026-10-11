export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export interface MobileConfig {
  readonly gatewayBaseUrl: string;
  readonly apiBaseUrl: string;
}

export interface MobileConfigInput {
  readonly expoPublicApiBaseUrl?: string;
}

/**
 * Resolves and validates the mobile client configuration.
 *
 * Requirements:
 * - Uses static `process.env.EXPO_PUBLIC_API_BASE_URL` access by default so Expo/Metro AST replacement works.
 * - Enforces strictly http: or https: protocols.
 * - Rejects URLs with embedded credentials (username/password), query strings, or hashes.
 * - Never echoes credentials in error messages.
 * - Normalizes redundant trailing slashes and /api prefixes.
 */
export function resolveMobileConfig(input?: MobileConfigInput): MobileConfig {
  // Static access allows Metro bundler to perform compile-time inlining of EXPO_PUBLIC_* variables
  const rawUrl = (input ? input.expoPublicApiBaseUrl : process.env.EXPO_PUBLIC_API_BASE_URL)?.trim();

  if (!rawUrl) {
    throw new ConfigurationError(
      'Missing EXPO_PUBLIC_API_BASE_URL. Please configure the Gateway base URL in your environment (e.g. http://localhost:4000 or http://<lan-ip>:4000 for mobile devices).',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ConfigurationError('Invalid URL provided for EXPO_PUBLIC_API_BASE_URL');
  }

  // Reject anything other than http: or https:
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ConfigurationError(
      'EXPO_PUBLIC_API_BASE_URL must use http: or https: protocol',
    );
  }

  // Reject embedded credentials (do not echo credentials in error message)
  if (parsed.username || parsed.password) {
    throw new ConfigurationError(
      'EXPO_PUBLIC_API_BASE_URL must not contain embedded user credentials',
    );
  }

  // Reject query parameters
  if (parsed.search) {
    throw new ConfigurationError(
      'EXPO_PUBLIC_API_BASE_URL must not contain a query string',
    );
  }

  // Reject URL fragments/hashes
  if (parsed.hash) {
    throw new ConfigurationError(
      'EXPO_PUBLIC_API_BASE_URL must not contain a URL hash or fragment',
    );
  }

  // Clean trailing slashes from pathname and normalize redundant /api
  let cleanedPath = parsed.pathname.replace(/\/+$/, '');
  if (cleanedPath === '/api' || cleanedPath.endsWith('/api')) {
    cleanedPath = cleanedPath.slice(0, -4);
  }

  const gatewayBaseUrl = `${parsed.protocol}//${parsed.host}${cleanedPath}`;
  const apiBaseUrl = `${gatewayBaseUrl}/api`;

  return {
    gatewayBaseUrl,
    apiBaseUrl,
  };
}
