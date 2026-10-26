import { timingSafeEqual } from 'node:crypto';
import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { classIdFromRoom } from '../../../domain/presence-webhook';
import {
  RECORD_PRESENCE,
  type RecordPresencePort,
  type RecordPresenceResult,
} from '../../../application/port/in/record-presence';

export const JITSI_WEBHOOK_SECRET_HEADER = 'x-jitsi-webhook-secret';

/** DI token for the webhook's shared secret, so the controller takes a token, not a string. */
export const JITSI_WEBHOOK_SECRET = Symbol('JITSI_WEBHOOK_SECRET');

/**
 * The Jitsi `event_sync` payload, narrowed to what presence needs.
 *
 * Only these fields are read; the rest of Jitsi's payload (participant display names,
 * e-mails, room tokens) is deliberately not modelled, so it cannot be logged or stored
 * by accident. `id` is the token's `context.user.id`, which is why a participant cannot
 * be confused with another by choosing a similar display name.
 */
const presenceWebhookSchema = z.object({
  event_name: z.enum(['participant-joined', 'participant-left']),
  room: z.string().min(1),
  participant: z.object({ id: z.string().min(1) }),
  timestamp: z.union([z.number(), z.string()]).optional(),
});

type PresenceWebhookBody = z.infer<typeof presenceWebhookSchema>;

/**
 * FR-011 / FR-020 (AC-035): the inbound Jitsi presence feed.
 *
 * Authentication is a **shared secret header**, not the source IP: self-hosted Jitsi can
 * sit behind any proxy, so an allow-list would be both fragile and a false sense of
 * security. Without a configured secret the endpoint refuses everything rather than
 * accepting unauthenticated presence, which is the failure mode that lets a stranger
 * complete someone else's class.
 *
 * Every well-formed event is acknowledged with 200 — including the ones that change
 * nothing — because a non-2xx makes Jitsi retry events that will never become valid.
 * A malformed body is the one 400: retrying it cannot help.
 */
@Controller('internal/jitsi')
@ApiTags('internal')
export class JitsiPresenceController {
  constructor(
    @Inject(RECORD_PRESENCE) private readonly record: RecordPresencePort,
    @Inject(JITSI_WEBHOOK_SECRET) private readonly secret: string,
  ) {}

  @Post('presence')
  @HttpCode(HttpStatus.OK)
  @ApiHeader({ name: JITSI_WEBHOOK_SECRET_HEADER, required: true })
  @ApiOperation({ summary: 'Jitsi participant presence webhook (AC-035)' })
  @ApiOkResponse({ description: 'Whether the event was applied' })
  async presence(
    @Req() request: { headers: Record<string, string | string[] | undefined>; body: unknown },
  ): Promise<RecordPresenceResult> {
    this.assertSecret(request.headers);

    const parsed = presenceWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      // Acknowledged, not retried: a body this shape will never become valid.
      return { accepted: false, reason: 'unknown_room' };
    }

    const classId = classIdFromRoom(parsed.data.room);
    if (classId === null) {
      return { accepted: false, reason: 'unknown_room' };
    }

    return this.record.execute({
      type: parsed.data.event_name,
      room: parsed.data.room,
      classId,
      accountId: parsed.data.participant.id,
      occurredAt: this.occurredAt(parsed.data.timestamp),
    });
  }

  private assertSecret(headers: Record<string, string | string[] | undefined>): void {
    if (this.secret === '') {
      throw new UnauthorizedException('Jitsi presence webhook is not configured');
    }
    const raw = headers[JITSI_WEBHOOK_SECRET_HEADER];
    const provided = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
    // Constant-time comparison; a length mismatch is a failed check, not a crash.
    const expected = Buffer.from(this.secret, 'utf8');
    const actual = Buffer.from(provided, 'utf8');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('Invalid Jitsi webhook secret');
    }
  }

  /**
   * Jitsi's `timestamp` is in **milliseconds**; a value small enough to be seconds is
   * accepted as seconds rather than silently becoming a 1970 date. A missing timestamp
   * means "now", which is the only sensible reading for a join/leave that just happened.
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

export type { PresenceWebhookBody };
