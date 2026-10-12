/**
 * Mobile API configuration (ADR-015).
 *
 * The app is mock-first: there is no network until a backend base URL is
 * configured. Set `EXPO_PUBLIC_API_BASE_URL` (e.g. `http://192.168.1.10:4000`)
 * and flip `USE_HTTP_API` to true to run against the real gateway. Nothing else
 * changes — the HTTP adapter satisfies the same `BookingGateway` port the mock
 * does, so the UI and application layers are untouched.
 */

/** The public gateway entry (never the api directly; the gateway forwards to it). */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/**
 * Whether the app should talk to the real gateway. Off by default so an Expo
 * dev build with no env keeps working against the in-process mock.
 */
export function httpApiEnabled(): boolean {
  return API_BASE_URL.length > 0;
}
