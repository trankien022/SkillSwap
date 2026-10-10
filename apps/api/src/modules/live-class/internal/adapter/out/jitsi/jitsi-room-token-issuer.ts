import { createHmac } from 'node:crypto';
import type {
  RoomToken,
  RoomTokenInput,
  RoomTokenIssuer,
} from '../../../application/port/out/room-token-issuer';

function base64url(input: Buffer | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * HS256 room-token issuer for the self-hosted Jitsi (ADR-020). Prosody accepts
 * tokens signed with the shared `JITSI_APP_SECRET`; the claims follow the
 * Jitsi JWT format (aud/iss = app id, `context.user.moderator`).
 */
export class JitsiRoomTokenIssuer implements RoomTokenIssuer {
  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly ttlSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  issue(input: RoomTokenInput): RoomToken {
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const expiresAt = issuedAt + this.ttlSeconds;

    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(
      JSON.stringify({
        aud: this.appId,
        iss: this.appId,
        sub: this.appId,
        room: input.room,
        exp: expiresAt,
        nbf: issuedAt - 10,
        iat: issuedAt,
        context: {
          user: {
            id: input.userId,
            name: input.displayName,
            email: input.email ?? '',
            moderator: input.role === 'moderator',
          },
        },
      }),
    );
    const signingInput = `${header}.${payload}`;
    const signature = createHmac('sha256', this.appSecret).update(signingInput).digest();
    return {
      token: `${signingInput}.${base64url(signature)}`,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }
}
