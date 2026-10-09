import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type {
  AccessTokenInput,
  IssuedAccessToken,
  TokenService,
} from '../../../application/port/out/token-service';

function base64url(input: Buffer | string): string {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * RS256 access-token issuance with node:crypto (ADR-016) — the same key pair
 * the gateway verifies (ADR-008). Refresh tokens are opaque random strings
 * stored only as SHA-256 hashes.
 */
export class NodeTokenService implements TokenService {
  private readonly privateKey: ReturnType<typeof createPrivateKey>;

  constructor(
    privateKeyPath: string,
    private readonly accessTokenTtlSeconds: number,
    private readonly now: () => Date = () => new Date(),
  ) {
    try {
      this.privateKey = createPrivateKey(readFileSync(privateKeyPath, 'utf8'));
    } catch {
      throw new Error(`JWT private key not readable at ${privateKeyPath} — run "pnpm keys:gen"`);
    }
  }

  issueAccessToken(input: AccessTokenInput): IssuedAccessToken {
    const issuedAt = Math.floor(this.now().getTime() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64url(
      JSON.stringify({
        sub: input.accountId,
        email: input.email,
        role: input.role,
        jti: randomBytes(16).toString('hex'),
        iat: issuedAt,
        exp: issuedAt + this.accessTokenTtlSeconds,
      }),
    );
    const signingInput = `${header}.${payload}`;
    const signature = sign('RSA-SHA256', Buffer.from(signingInput), this.privateKey);
    return {
      token: `${signingInput}.${base64url(signature)}`,
      expiresInSeconds: this.accessTokenTtlSeconds,
    };
  }

  newRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
