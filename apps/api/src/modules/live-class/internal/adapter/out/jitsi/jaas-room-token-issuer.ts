import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type {
  RoomToken,
  RoomTokenInput,
  RoomTokenIssuer,
} from '../../../application/port/out/room-token-issuer';

function base64url(input: Buffer | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface JaasRoomTokenIssuerOptions {
  /** JaaS AppID, e.g. `vpaas-magic-cookie-1fc5…`. */
  appId: string;
  /** Key id from the 8x8 API-key page. JaaS expects `kid: "<appId>/<keyId>"` verbatim. */
  keyId: string;
  /** PEM private key belonging to that API key. Never logged, never returned. */
  privateKeyPem: string;
  ttlSeconds: number;
  now?: () => Date;
}

/**
 * Reads the JaaS API private key, failing loudly when it is absent.
 *
 * A silent fallback or a generated throwaway key would boot fine and then reject every token at
 * the provider, which surfaces as "video is broken" rather than "the key is missing". Failing at
 * construction puts the error in the startup log where the misconfiguration actually is.
 */
export function readJitsiPrivateKey(path: string): string {
  if (path.length === 0) {
    throw new Error(
      'JITSI_PRIVATE_KEY_PATH is not set: hosted Jitsi (JaaS) cannot issue room tokens without ' +
        'the API private key (ADR-039). Run `pnpm keys:gen` for a local placeholder.',
    );
  }
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new Error(
      `JaaS private key not readable at ${path} — run "pnpm keys:gen" for a local placeholder, or ` +
        'point JITSI_PRIVATE_KEY_PATH at the PEM from the 8x8 console (ADR-039)',
    );
  }
}

/**
 * RS256 room-token issuer for hosted Jitsi (JaaS, ADR-039).
 *
 * The claim shape is not interchangeable with the self-hosted one, and each difference fails
 * quietly rather than loudly:
 *
 * - `aud` and `iss` are the **fixed strings** `jitsi` and `chat`; the tenant lives in `sub`.
 *   The old issuer put the app id in `aud`/`iss`, which JaaS rejects.
 * - `moderator` is the **string** `"true"`, not a boolean. A boolean is not a type error at
 *   sign time — it fails the claim check and silently demotes every teacher to participant,
 *   which would strand them unable to end a class.
 * - `room` must be the **bare room node** (`skillswap-<classId>`), *not* the tenant-prefixed
 *   name. The tenant is carried by `sub`; prefixing the claim makes every join fail with
 *   "Room and token mismatched". JaaS only reports the prefixed `fqn` to the presence webhook
 *   after the join succeeds — that is a different field from this claim.
 *
 * Signing is `node:crypto` rather than the 8x8 SDK: it is one call, and a pinned test over the
 * verified claim shape is worth more than an opaque dependency in the room-access path.
 */
export class JaasRoomTokenIssuer implements RoomTokenIssuer {
  private readonly now: () => Date;

  constructor(private readonly options: JaasRoomTokenIssuerOptions) {
    this.now = options.now ?? (() => new Date());
  }

  issue(input: RoomTokenInput): RoomToken {
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const expiresAt = issuedAt + this.options.ttlSeconds;

    const header = base64url(
      JSON.stringify({
        alg: 'RS256',
        // Documented as "<appId>/<keyId>"; the API-key page shows the combined value.
        kid: `${this.options.appId}/${this.options.keyId}`,
        typ: 'JWT',
      }),
    );

    const payload = base64url(
      JSON.stringify({
        aud: 'jitsi',
        iss: 'chat',
        sub: this.options.appId,
        room: this.roomClaim(input.room),
        exp: expiresAt,
        // A small backdate absorbs clock skew between this process and JaaS.
        nbf: issuedAt - 10,
        context: {
          user: {
            id: input.userId,
            name: input.displayName,
            email: input.email ?? '',
            // String, not boolean — see the class comment.
            moderator: input.role === 'moderator' ? 'true' : 'false',
          },
        },
      }),
    );

    const signingInput = `${header}.${payload}`;
    const signature = createSign('RSA-SHA256').update(signingInput).sign(this.options.privateKeyPem);

    return {
      token: `${signingInput}.${base64url(signature)}`,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  }

  /**
   * The `room` claim is the **bare room node** (`skillswap-<classId>`); the tenant lives in `sub`.
   *
   * JaaS rejects a tenant-prefixed claim with "Room and token mismatched". Its validator
   * (`token/util.lib.lua`, `Util:verify_room`) builds the expected MUC address as
   * `jid.join(room_claim, "conference." .. sub)`, so a claim that already contains the AppID can
   * never match a real room — reproduced against the live tenant, see the 2026-11-09 plan.
   *
   * The strip is defensive only: it keeps a caller that passes an already-qualified room from
   * producing a token JaaS would refuse.
   */
  private roomClaim(room: string): string {
    const prefix = `${this.options.appId}/`;
    return room.startsWith(prefix) ? room.slice(prefix.length) : room;
  }
}
