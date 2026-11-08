import { createVerify, generateKeyPairSync } from 'node:crypto';
import { JaasRoomTokenIssuer } from './jaas-room-token-issuer';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKeyPem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

const APP_ID = 'vpaas-magic-cookie-1fc542a3e4414a44b2611668195e2bfe';

function decode(segment: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('JaasRoomTokenIssuer (FR-011 / ADR-039)', () => {
  const now = (): Date => new Date('2026-10-12T00:00:00.000Z');
  const issuer = new JaasRoomTokenIssuer({
    appId: APP_ID,
    keyId: '4f4910',
    privateKeyPem,
    ttlSeconds: 3600,
    now,
  });

  const issue = (overrides: { role?: 'moderator' | 'participant' } = {}) =>
    issuer.issue({
      room: 'skillswap-cls-1',
      userId: 'u1',
      displayName: 'An',
      email: 'an@example.com',
      role: overrides.role ?? 'moderator',
    });

  it('signs with RS256 and the documented kid shape', () => {
    const [header] = issue().token.split('.');
    expect(decode(header)).toEqual({
      alg: 'RS256',
      // 8x8 expects the AppID and the key id combined, not the bare key id.
      kid: `${APP_ID}/4f4910`,
      typ: 'JWT',
    });
  });

  it('puts the fixed aud/iss in place and the tenant in sub', () => {
    const payload = decode(issue().token.split('.')[1]);
    // The old HS256 issuer put the app id here; JaaS rejects that.
    expect(payload.aud).toBe('jitsi');
    expect(payload.iss).toBe('chat');
    expect(payload.sub).toBe(APP_ID);
  });

  it('tenant-prefixes the room claim', () => {
    expect(decode(issue().token.split('.')[1]).room).toBe(`${APP_ID}/skillswap-cls-1`);
  });

  it('does not double-prefix an already-qualified room', () => {
    const { token } = issuer.issue({
      room: `${APP_ID}/skillswap-cls-1`,
      userId: 'u1',
      displayName: 'An',
      role: 'participant',
    });
    expect(decode(token.split('.')[1]).room).toBe(`${APP_ID}/skillswap-cls-1`);
  });

  it('emits moderator as the STRING "true"/"false", never a boolean', () => {
    // A boolean passes TS and signing but fails JaaS's claim check, silently demoting every
    // teacher — so this is pinned as a string comparison, not a truthiness check.
    const moderator = decode(issue({ role: 'moderator' }).token.split('.')[1]).context as {
      user: { moderator: unknown };
    };
    expect(moderator.user.moderator).toBe('true');

    const participant = decode(issue({ role: 'participant' }).token.split('.')[1]).context as {
      user: { moderator: unknown };
    };
    expect(participant.user.moderator).toBe('false');
  });

  it('carries the user context, exp and a skew-tolerant nbf', () => {
    const payload = decode(issue().token.split('.')[1]);
    const issuedAt = Math.floor(now().getTime() / 1000);
    expect(payload.exp).toBe(issuedAt + 3600);
    expect(payload.nbf).toBe(issuedAt - 10);
    expect(payload.context).toMatchObject({
      user: { id: 'u1', name: 'An', email: 'an@example.com' },
    });
  });

  it('produces a signature that verifies against the public key', () => {
    const [header, payload, signature] = issue().token.split('.');
    const verified = createVerify('RSA-SHA256')
      .update(`${header}.${payload}`)
      .verify(publicKeyPem, Buffer.from(signature, 'base64url'));
    expect(verified).toBe(true);
  });

  it('reports expiry as an ISO instant matching the exp claim', () => {
    const { token, expiresAt } = issue();
    expect(expiresAt).toBe(new Date((decode(token.split('.')[1]).exp as number) * 1000).toISOString());
  });
});
