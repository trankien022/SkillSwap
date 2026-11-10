import { createHmac } from 'node:crypto';

/**
 * Builds a JaaS presence delivery the way the provider does (ADR-039).
 *
 * The signature is `HMAC-SHA256("<t>.<raw body>")` base64-encoded into
 * `X-Jaas-Signature: t=<t>,v1=<sig>`, computed over the **exact bytes** sent. The e2e
 * client therefore has to serialise the body itself and hand the same string to both the
 * signer and the request — that is what makes these specs exercise the real verification
 * path rather than a re-serialised approximation of it.
 */
export interface SignedWebhook {
  readonly body: string;
  readonly headers: Record<string, string>;
}

export function signJaasWebhook(payload: unknown, secret: string, at = new Date()): SignedWebhook {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(at.getTime() / 1000);
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('base64');
  return {
    body,
    headers: {
      'content-type': 'application/json',
      'x-jaas-signature': `t=${timestamp},v1=${signature}`,
    },
  };
}

/**
 * A `PARTICIPANT_JOINED` / `PARTICIPANT_LEFT` payload in JaaS's shape.
 *
 * `fqn` is tenant-qualified (`<appId>/<room>`), and `data.id` is the JWT `context.user.id`
 * the API issued — the identity presence is attributed to.
 */
export function participantEvent(
  appId: string,
  classId: string,
  eventType: 'PARTICIPANT_JOINED' | 'PARTICIPANT_LEFT',
  occupantId: string,
  at: Date,
): Record<string, unknown> {
  return {
    idempotencyKey: `${eventType}-${occupantId}-${at.getTime()}`,
    appId,
    eventType,
    fqn: `${appId}/skillswap-${classId}`,
    sessionId: `session-${classId}`,
    timestamp: at.getTime(),
    data: { id: occupantId, participantId: `p-${occupantId}` },
  };
}

/**
 * A `ROOM_DESTROYED` payload in JaaS's shape.
 *
 * Deliberately has **no `data.id`**: 8x8 documents `data` as only `conference` / `isBreakout` /
 * `breakoutRoomId`, because the event is about the room rather than a participant. A helper
 * that added an identity would hide the very thing that made this event unusable before
 * ADR-021 Amendment D.3 — that it must route before the identity gate.
 */
export function roomDestroyedEvent(
  appId: string,
  classId: string,
  at: Date,
): Record<string, unknown> {
  return {
    idempotencyKey: `ROOM_DESTROYED-${classId}-${at.getTime()}`,
    customerId: appId.replace('vpaas-magic-cookie-', ''),
    appId,
    eventType: 'ROOM_DESTROYED',
    sessionId: `session-${classId}`,
    timestamp: at.getTime(),
    fqn: `${appId}/skillswap-${classId}`,
    data: {
      conference: `${classId}@conference.${appId}.stage.8x8.vc`,
      isBreakout: false,
    },
  };
}
