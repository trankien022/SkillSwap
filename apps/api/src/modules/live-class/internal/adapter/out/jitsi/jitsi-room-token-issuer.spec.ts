import { JitsiRoomTokenIssuer } from './jitsi-room-token-issuer';

function decode(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('JitsiRoomTokenIssuer (FR-011 / ADR-020)', () => {
  const now = (): Date => new Date('2026-10-12T00:00:00.000Z');
  const issuer = new JitsiRoomTokenIssuer('skillswap', 'secret', 3600, now);

  it('signs an HS256 token with app id, room, exp and user context', () => {
    const { token, expiresAt } = issuer.issue({
      room: 'skillswap-cls-1',
      userId: 'u1',
      displayName: 'An',
      email: 'an@example.com',
      role: 'moderator',
    });
    const [header] = token.split('.');
    expect(JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))).toEqual({
      alg: 'HS256',
      typ: 'JWT',
    });
    const payload = decode(token);
    expect(payload.aud).toBe('skillswap');
    expect(payload.iss).toBe('skillswap');
    expect(payload.room).toBe('skillswap-cls-1');
    const issuedAt = Math.floor(now().getTime() / 1000);
    expect(payload.iat).toBe(issuedAt);
    expect(payload.exp).toBe(issuedAt + 3600);
    expect(expiresAt).toBe(new Date((issuedAt + 3600) * 1000).toISOString());
    expect(payload.context).toEqual({
      user: { id: 'u1', name: 'An', email: 'an@example.com', moderator: true },
    });
  });

  it('marks only a moderator role as moderator', () => {
    const learner = decode(
      issuer.issue({ room: 'r', userId: 'u2', displayName: 'Bo', role: 'participant' }).token,
    );
    expect((learner.context as { user: { moderator: boolean } }).user.moderator).toBe(false);
  });
});
