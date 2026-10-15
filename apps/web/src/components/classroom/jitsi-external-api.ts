/**
 * FR-011 (ADR-020): embed the real self-hosted Jitsi room.
 *
 * The room and its short-lived JWT come from
 * `POST /api/classes/bookings/{bookingId}/room-access`. The `url` that endpoint
 * returns points at the Jitsi deployment (e.g. `https://localhost:8443/<room>`),
 * and the same origin serves Jitsi's own `external_api.js`. We load that script
 * and construct `JitsiMeetExternalAPI` with the **real** token, so the meeting
 * runs inside SkillSwap's page instead of opening a bare link that Jitsi would
 * reject (the deployment enforces JWT auth via `authdomain`).
 *
 * Loading the script from the deployment itself avoids an npm dependency and
 * guarantees the embed API version matches the server. `external_api.js` on our
 * Jitsi answers 200 and exposes `JitsiMeetExternalAPI` + `executeCommand`.
 */

/** Subset of the External API we use. Kept local so we depend on no @types. */
export interface JitsiApi {
  executeCommand(command: string, ...args: unknown[]): void;
  dispose(): void;
  addEventListener(event: string, listener: (payload: unknown) => void): void;
  removeEventListener(event: string, listener: (payload: unknown) => void): void;
}

export interface JitsiApiOptions {
  roomName: string;
  parentNode: HTMLElement;
  /**
   * Protocol (`https`) of the Jitsi deployment. The constructor's first argument
   * takes the bare host; the frame URL needs this to avoid inheriting `http:`.
   */
  protocol?: string;
  /** Short-lived JWT minted by room-access. Sent as `jwt` so authdomain accepts us. */
  jwt?: string;
  displayName?: string;
  /** Join muted so a learner never broadcasts before they are ready. */
  audioMuted?: boolean;
  videoMuted?: boolean;
  /** Prejoin keeps Jitsi's own device check in front of the call. */
  prejoinEnabled?: boolean;
}

interface JitsiMeetExternalAPIConstructor {
  new (domain: string, options: Record<string, unknown>): JitsiApi;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiMeetExternalAPIConstructor;
  }
}

const SCRIPT_ID = 'skillswap-jitsi-external-api';

/** Strips a trailing path so `https://host:8443/room` becomes `https://host:8443`. */
export function jitsiDomainFromUrl(roomUrl: string): string {
  try {
    const parsed = new URL(roomUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return roomUrl.replace(/\/+$/, '');
  }
}

/**
 * The HOST part only (`localhost:8443`), without protocol.
 *
 * `JitsiMeetExternalAPI(domain, …)` expects a bare host: it builds the frame URL
 * itself as `{protocol}://{domain}/{room}`. Passing the full origin here produced
 * a malformed frame src `https://https//localhost:8443/room` (the API prefixed
 * another `https://`), so the conference iframe never loaded. The protocol is a
 * separate `protocol` option, supplied by {@link jitsiProtocolFromUrl}.
 */
export function jitsiHostFromUrl(roomUrl: string): string {
  try {
    return new URL(roomUrl).host;
  } catch {
    return roomUrl.replace(/^[a-z]+:\/\//i, '').replace(/\/.*$/, '').replace(/\/+$/, '');
  }
}

/** The protocol of the room URL without the colon (`https`), for the API options. */
export function jitsiProtocolFromUrl(roomUrl: string): string {
  try {
    return new URL(roomUrl).protocol.replace(/:$/, '');
  } catch {
    return 'https';
  }
}

/**
 * Injects `external_api.js` once per document and resolves when
 * `window.JitsiMeetExternalAPI` is available. Rejects on a network/script error
 * so the caller can show a real failure instead of an empty stage.
 */
export function loadJitsiExternalApi(baseUrl: string): Promise<JitsiMeetExternalAPIConstructor> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Jitsi can only load in the browser'));
  }
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve(window.JitsiMeetExternalAPI);
  }

  const src = `${baseUrl.replace(/\/+$/, '')}/external_api.js`;
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

  return new Promise((resolve, reject) => {
    const onReady = () => {
      if (window.JitsiMeetExternalAPI) {
        resolve(window.JitsiMeetExternalAPI);
      } else {
        reject(new Error(`Jitsi external_api.js loaded but JitsiMeetExternalAPI is missing (${src})`));
      }
    };

    if (existing) {
      // A load is already in flight: wait for it. `readyState` is not exposed on
      // dynamically injected scripts, so re-attach listeners on the in-flight tag.
      existing.addEventListener('load', onReady, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = src;
    script.async = true;
    script.addEventListener('load', onReady, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

/** Builds the External API options object (separated for unit testing). */
export function buildJitsiOptions(options: JitsiApiOptions): Record<string, unknown> {
  return {
    roomName: options.roomName,
    parentNode: options.parentNode,
    // The frame URL is `{protocol}://{domain}/{room}`. The protocol is a separate
    // option (the first constructor argument carries only the host); without it
    // the frame would inherit the page's `http:` and mixed-content-block.
    ...(options.protocol ? { protocol: options.protocol } : {}),
    ...(options.jwt ? { jwt: options.jwt } : {}),
    ...(options.displayName ? { userInfo: { displayName: options.displayName } } : {}),
    configOverwrite: {
      startWithAudioMuted: options.audioMuted ?? true,
      startWithVideoMuted: options.videoMuted ?? false,
      prejoinConfig: { enabled: options.prejoinEnabled ?? true },
      // The classroom chrome already carries the branding; avoid a second header.
      disableDeepLinking: true,
    },
    interfaceConfigOverwrite: {
      SHOW_JITSI_WATERMARK: false,
      MOBILE_APP_PROMO: false,
    },
  };
}
