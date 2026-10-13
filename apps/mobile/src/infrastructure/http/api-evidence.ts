const routes = [
  /^\/auth\/(register|login|refresh|logout|me)$/,
  /^\/student-verifications(?:\/(documents|me))?$/,
  /^\/skills$/,
  /^\/skill-evidence$/,
  /^\/profile-skills\/me$/,
  /^\/wallet\/(balance|history|top-ups)$/,
  /^\/notifications$/,
  /^\/notification-devices$/,
  /^\/classes$/,
  /^\/classes\/bookings\/me$/,
];

export function evidenceRoute(url: string): string | null {
  const path = new URL(url).pathname.replace(/^\/api/, '');
  if (routes.some((route) => route.test(path))) return `/api${path}`;
  if (/^\/classes\/bookings\/[^/]+\/confirm$/.test(path))
    return '/api/classes/bookings/:bookingId/confirm';
  if (/^\/classes\/[^/]+\/bookings$/.test(path)) return '/api/classes/:id/bookings';
  if (/^\/classes\/[^/]+\/cancel$/.test(path)) return '/api/classes/:id/cancel';
  if (/^\/classes\/[^/]+$/.test(path)) return '/api/classes/:id';
  if (/^\/skill-evidence\/[^/]+\/history$/.test(path)) return '/api/skill-evidence/:id/history';
  if (/^\/notification-devices\/[^/]+$/.test(path)) return '/api/notification-devices/:id';
  return null;
}

/** Opt-in development evidence. Logs only allowlisted templates and HTTP metadata. */
export async function evidenceFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<Response> {
  if (process.env.EXPO_PUBLIC_API_EVIDENCE !== '1') return fetchImpl(url, init);
  const route = evidenceRoute(url);
  if (!route) return fetchImpl(url, init);
  const startedAt = Date.now();
  const traceId = `mobile-${startedAt}-${Math.random().toString(36).slice(2, 10)}`;
  let status = 0;
  try {
    const response = await fetchImpl(url, init);
    status = response.status;
    return response;
  } finally {
    // eslint-disable-next-line no-console -- Explicit opt-in acceptance evidence contains only safe metadata.
    console.info(
      '[mobile-api-evidence]',
      JSON.stringify({
        method: init.method ?? 'GET',
        route,
        status,
        timestamp: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        traceId,
        traceScope: 'client-request',
      }),
    );
  }
}
