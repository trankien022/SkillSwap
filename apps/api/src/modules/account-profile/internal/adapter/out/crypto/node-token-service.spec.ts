import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeTokenService } from './node-token-service';

function decodePayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('NodeTokenService', () => {
  let dir: string;
  let keyPath: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'skillswap-token-'));
    keyPath = join(dir, 'jwt-private.pem');
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('issues an RS256 access token with sub, role and exp', () => {
    const service = new NodeTokenService(keyPath, 900, () => new Date('2026-10-09T00:00:00.000Z'));
    const { token, expiresInSeconds } = service.issueAccessToken({
      accountId: 'acct-1',
      email: 'a@b.co',
      role: 'teacher',
    });
    expect(token.split('.')).toHaveLength(3);
    expect(expiresInSeconds).toBe(900);
    const payload = decodePayload(token);
    const issuedAt = Math.floor(Date.parse('2026-10-09T00:00:00.000Z') / 1000);
    expect(payload.sub).toBe('acct-1');
    expect(payload.role).toBe('teacher');
    expect(payload.iat).toBe(issuedAt);
    expect(payload.exp).toBe(issuedAt + 900);
  });

  it('generates distinct refresh tokens and a stable hash', () => {
    const service = new NodeTokenService(keyPath, 900);
    const a = service.newRefreshToken();
    const b = service.newRefreshToken();
    expect(a).not.toBe(b);
    expect(service.hashRefreshToken(a)).toBe(service.hashRefreshToken(a));
    expect(service.hashRefreshToken(a)).not.toBe(service.hashRefreshToken(b));
  });

  it('fails fast when the key file is missing', () => {
    expect(() => new NodeTokenService(join(dir, 'missing.pem'), 900)).toThrow('pnpm keys:gen');
  });
});
