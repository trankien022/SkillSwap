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
  /^\/verifiers\/me\/queue$/,
];

export function evidenceRoute(url: string): string | null {
  const path = new URL(url).pathname.replace(/^\/api/, '');
  // The poll route (FR-008 / ADR-033). `callback` is excluded explicitly: it is
  // server-to-server, is never posted by this client, and would otherwise match
  // the `:id` template and be recorded as client evidence.
  if (/^\/wallet\/top-ups\/(?!callback$)[^/]+$/.test(path)) return '/api/wallet/top-ups/:id';
  // The same read keyed by invoice number, used by the return path.
  if (/^\/wallet\/top-ups\/by-provider-ref\/[^/]+$/.test(path))
    return '/api/wallet/top-ups/by-provider-ref/:providerRef';
  if (routes.some((route) => route.test(path))) return `/api${path}`;
  // Booking actions. Declared before the bare `:id` templates below so a booking
  // route can never be recorded as a class route.
  if (/^\/classes\/bookings\/[^/]+\/confirm$/.test(path))
    return '/api/classes/bookings/:bookingId/confirm';
  if (/^\/classes\/bookings\/[^/]+\/rating$/.test(path))
    return '/api/classes/bookings/:bookingId/rating';
  if (/^\/classes\/bookings\/[^/]+\/room-access$/.test(path))
    return '/api/classes/bookings/:bookingId/room-access';
  if (/^\/classes\/bookings\/[^/]+\/no-show$/.test(path))
    return '/api/classes/bookings/:bookingId/no-show';
  // Class actions (`cancel`, `start`, `complete`) and the bare class resource.
  if (/^\/classes\/[^/]+\/(cancel|start|complete)$/.test(path)) return `/api${path}`;
  if (/^\/classes\/[^/]+\/bookings$/.test(path)) return '/api/classes/:id/bookings';
  if (/^\/classes\/[^/]+$/.test(path)) return '/api/classes/:id';
  if (/^\/skill-evidence\/[^/]+\/history$/.test(path)) return '/api/skill-evidence/:id/history';
  if (/^\/skill-evidence\/[^/]+\/(claim|decision)$/.test(path)) return `/api${path}`;
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
