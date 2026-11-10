import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UnauthorizedException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { classIdFromRoom } from '../../../domain/presence-webhook';
import {
  RECORD_PRESENCE,
  type RecordPresencePort,
  type RecordPresenceResult,
} from '../../../application/port/in/record-presence';

/** JaaS signs every delivery with this header: `t=<unix seconds>,v1=<base64 hmac>`. */
export const JAAS_SIGNATURE_HEADER = 'x-jaas-signature';

/** DI token for the webhook's endpoint secret, so the controller takes a token, not a string. */
export const JITSI_WEBHOOK_SECRET = Symbol('JITSI_WEBHOOK_SECRET');

/** How far apart the delivery timestamp and our clock may be before we call it a replay. */
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/**
 * The JaaS webhook payload, narrowed to what presence needs.
 *
 * Only these fields are read; the rest (participant display names, e-mails, avatar URLs) is
 * deliberately not modelled, so it can neither be logged nor stored (NFR-004). `data.id` is the
 * JWT `context.user.id` we issued, which is why a participant cannot be impersonated by
 * choosing a similar display name.
 *
 * A webhook carries many event types and only two of them mean anything here, so `eventType`
 * stays a plain string: narrowing it with an enum would turn every unrelated event (recording,
 * transcription, lobby) into a schema failure and a needless 400.
 */
const jaasWebhookSchema = z.object({
  eventType: z.string().min(1),
  /** Fully-qualified room, `<appId>/<room>`; `conference` is the older spelling. */
  fqn: z.string().min(1).optional(),
  conference: z.string().min(1).optional(),
  /** The tenant's AppID, e.g. `vpaas-magic-cookie-…`. */
  appId: z.string().min(1).optional(),
  timestamp: z.union([z.number(), z.string()]).optional(),
  data: z
    .object({
      id: z.string().min(1).optional(),
      participantId: z.string().min(1).optional(),
    })
    .optional(),
});

type JaasWebhookBody = z.infer<typeof jaasWebhookSchema>;

/** JaaS event names mapped onto the domain's two presence types. */
const EVENT_TYPES: Readonly<Record<string, 'participant-joined' | 'participant-left'>> = {
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
};

/**
 * FR-011 / FR-020 (AC-035): the inbound hosted-Jitsi presence feed (ADR-039).
 *
 * Authentication is the endpoint's **signing secret**, not a shared plaintext header and not the
 * source IP. JaaS computes `HMAC-SHA256("<t>.<raw body>")` and base64-encodes it into
 * `X-Jaas-Signature: t=<t>,v1=<sig>`, so the check must run over the **raw** bytes — a
 * re-serialised body would produce a different digest and every genuine event would be rejected.
 * `rawBody` is already enabled at bootstrap for exactly this.
 *
 * Without a configured secret the endpoint refuses everything rather than accepting
 * unauthenticated presence, which is the failure mode that lets a stranger complete someone
 * else's class and release money.
 *
 * Every well-formed event is acknowledged with 200 — including the ones that change nothing —
 * because a non-2xx makes JaaS retry events that will never become valid. A malformed body is
 * the one 400: retrying it cannot help.
 */
// ADR-042: this URL is registered in the 8x8 console, which we cannot change from
// here. A `/v1` segment would stop presence arriving and silently degrade class
// completion (AC-035), so the route opts out of versioning entirely.
@Controller({ path: 'internal/jitsi', version: VERSION_NEUTRAL })
@ApiTags('internal')
export class JitsiPresenceController {
  constructor(
    @Inject(RECORD_PRESENCE) private readonly record: RecordPresencePort,
    @Inject(JITSI_WEBHOOK_SECRET) private readonly secret: string,
  ) {}

  @Post('presence')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: JAAS_SIGNATURE_HEADER, required: true })
  @ApiOperation({ summary: 'JaaS participant presence webhook (AC-035)' })
  @ApiOkResponse({ description: 'Whether the event was applied' })
  async presence(
    @Req()
    request: {
      headers: Record<string, string | string[] | undefined>;
      body: unknown;
      rawBody?: Buffer;
    },
  ): Promise<RecordPresenceResult> {
    this.assertSignature(request.headers, request.rawBody, request.body);

    const parsed = jaasWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      // Acknowledged, not retried: a body this shape will never become valid.
      return { accepted: false, reason: 'unknown_room' };
    }

    const type = EVENT_TYPES[parsed.data.eventType];
    if (type === undefined) {
      // Recordings, lobby, transcription: real events this endpoint has no opinion on.
      return { accepted: false, reason: 'unknown_room' };
    }

    const room = parsed.data.fqn ?? parsed.data.conference;
    if (room === undefined) {
      return { accepted: false, reason: 'unknown_room' };
    }

    const classId = classIdFromRoom(room);
    if (classId === null) {
      return { accepted: false, reason: 'unknown_room' };
    }

    const accountId = parsed.data.data?.id;
    if (accountId === undefined) {
      // No jwt-backed identity: nothing can be attributed, and guessing would let a name
      // collide with a real party.
      return { accepted: false, reason: 'unknown_party' };
    }

    return this.record.execute({
      type,
      room,
      classId,
      accountId,
      occurredAt: this.occurredAt(parsed.data.timestamp),
    });
  }

  /**
   * Verifies `X-Jaas-Signature` over the raw request body.
   *
   * The timestamp is part of the signed payload, so it also bounds replay: a correctly signed
   * delivery older than the tolerance window is refused. Both checks are constant-time.
   */
  private assertSignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | undefined,
    parsedBody: unknown,
  ): void {
    if (this.secret === '') {
      throw new UnauthorizedException('Jitsi presence webhook is not configured');
    }

    const raw = headers[JAAS_SIGNATURE_HEADER];
    const header = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
    if (header === '') {
      throw new UnauthorizedException('Missing JaaS webhook signature');
    }

    const parts = new Map<string, string>();
    for (const segment of header.split(',')) {
      const index = segment.indexOf('=');
      if (index > 0) {
        parts.set(segment.slice(0, index).trim(), segment.slice(index + 1).trim());
      }
    }
    const timestamp = parts.get('t');
    const provided = parts.get('v1');
    if (timestamp === undefined || provided === undefined) {
      throw new UnauthorizedException('Malformed JaaS webhook signature');
    }

    const seconds = Number(timestamp);
    if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > SIGNATURE_TOLERANCE_SECONDS) {
      throw new UnauthorizedException('Stale JaaS webhook signature');
    }

    // The signed material is the timestamp, a literal dot, then the exact bytes received.
    // `rawBody` is what Nest buffered before parsing; falling back to the re-serialised body
    // would only keep a test working while rejecting every real delivery, so it is refused.
    const body = rawBody === undefined ? null : rawBody.toString('utf8');
    if (body === null) {
      throw new UnauthorizedException('JaaS webhook signature cannot be verified without a raw body');
    }
    void parsedBody;

    const expected = createHmac('sha256', this.secret)
      .update(`${timestamp}.${body}`, 'utf8')
      .digest('base64');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(provided, 'utf8');
    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      throw new UnauthorizedException('Invalid JaaS webhook signature');
    }
  }

  /**
   * JaaS's `timestamp` is in **milliseconds**; a value small enough to be seconds is accepted
   * as seconds rather than silently becoming a 1970 date. A missing timestamp means "now",
   * which is the only sensible reading for a join/leave that just happened.
   */
  private occurredAt(timestamp: number | string | undefined): Date {
    if (timestamp === undefined) {
      return new Date();
    }
    const numeric = typeof timestamp === 'number' ? timestamp : Number(timestamp);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return new Date();
    }
    return new Date(numeric < 1e12 ? numeric * 1000 : numeric);
  }
}

export type { JaasWebhookBody };
