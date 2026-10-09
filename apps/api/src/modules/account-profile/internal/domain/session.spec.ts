import {
  assertSessionActive,
  isSessionActive,
  SessionExpiredError,
  SessionRevokedError,
  type Session,
} from './session';

const base: Session = {
  id: 's1',
  accountId: 'a1',
  refreshTokenHash: 'hash',
  expiresAt: '2026-10-09T01:00:00.000Z',
  revokedAt: null,
  createdAt: '2026-10-09T00:00:00.000Z',
};

describe('session domain', () => {
  const now = new Date('2026-10-09T00:30:00.000Z');

  it('treats a live session as active', () => {
    expect(isSessionActive(base, now)).toBe(true);
    expect(() => assertSessionActive(base, now)).not.toThrow();
  });

  it('expires at the boundary (not after)', () => {
    const atExpiry = new Date('2026-10-09T01:00:00.000Z');
    expect(isSessionActive(base, atExpiry)).toBe(false);
    expect(() => assertSessionActive(base, atExpiry)).toThrow(SessionExpiredError);
  });

  it('rejects a revoked session', () => {
    const revoked = { ...base, revokedAt: '2026-10-09T00:20:00.000Z' };
    expect(() => assertSessionActive(revoked, now)).toThrow(SessionRevokedError);
  });
});
