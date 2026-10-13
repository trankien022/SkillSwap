import { ApiResponseError, unwrapEnvelope } from '@skillswap/contracts';
import { API_BASE_URL } from './api-config';
import { evidenceFetch } from './api-evidence';

/**
 * Thin envelope-aware HTTP client for the mobile app (NFR-013).
 *
 * This is the ONLY place in the mobile package that knows about the wire
 * envelope `{ success, code, message, data, errors }`. It uses the shared
 * `unwrapEnvelope` from `@skillswap/contracts`, so parsing is identical to the
 * web client, and returns the bare `data` payload. Callers (gateways) never see
 * `success`/`errors`; on failure they receive an `ApiResponseError` carrying the
 * stable domain `code` (e.g. `duplicate_booking`, `class_full`).
 */
export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Injected so specs can substitute a fake fetch; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  /** Overrides `API_BASE_URL` (specs, or a per-client base); defaults to the app config. */
  baseUrl?: string;
}

/** Sends a request to the gateway and returns the unwrapped `data` payload. */
export async function requestJson<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  // Call `fetch` through its owning global. The browser's `fetch` throws
  // "Illegal invocation" when the receiver is anything other than `window`, and
  // both `fetchImpl` (passed in as a bare value) and a stored `fetch` reference
  // would otherwise be invoked with `undefined` as the receiver.
  const impl = options.fetchImpl ?? globalThis.fetch;
  const doFetch = impl.bind(globalThis);
  const base = options.baseUrl ?? API_BASE_URL;
  if (base.length === 0) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not set; the HTTP API is disabled.');
  }
  const res = await evidenceFetch(doFetch, `${base}/api${path}`, {
    method: options.method ?? 'GET',
    signal: options.signal,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });

  if (res.status === 204) return undefined as T;
  try {
    return await unwrapEnvelope<T>(res);
  } catch (error) {
    if (error instanceof Error) Object.assign(error, { status: res.status });
    throw error;
  }
}

export { ApiResponseError };
