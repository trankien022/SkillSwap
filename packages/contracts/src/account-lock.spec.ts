import {
  SYSTEM_ACTOR_ID,
  accountStatusChangedSchema,
  suspendedAccountSchema,
  suspendAccountSchema,
} from './index';

/**
 * FR-015 / OQ-015 / ADR-037: the account-lock contract.
 *
 * The two things a reader must be able to rely on: a suspension always carries a reason and an
 * actor, and the actor is never confused with the subject.
 */

const ADMIN = '7c1e0000-0000-4000-8000-0000000000a1';
const SUBJECT = '7c1e0000-0000-4000-8000-0000000000b2';

function event(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    accountId: SUBJECT,
    status: 'suspended',
    previousStatus: 'active',
    reason: 'Repeated payment fraud',
    occurredAt: '2026-10-26T09:00:00.000Z',
    actorId: ADMIN,
    ...overrides,
  };
}

describe('suspendAccountSchema', () => {
  it('accepts a reason', () => {
    expect(suspendAccountSchema.parse({ reason: 'Repeated payment fraud' }).reason).toBe(
      'Repeated payment fraud',
    );
  });

  it('trims the reason, so whitespace is not a reason', () => {
    expect(() => suspendAccountSchema.parse({ reason: '   ' })).toThrow();
  });

  it('requires the reason at all', () => {
    expect(() => suspendAccountSchema.parse({})).toThrow();
  });
});

describe('accountStatusChangedSchema', () => {
  it('accepts a suspension with a reason and keeps actor distinct from subject', () => {
    const parsed = accountStatusChangedSchema.parse(event());
    expect(parsed.accountId).toBe(SUBJECT);
    expect(parsed.actorId).toBe(ADMIN);
    expect(parsed.actorId).not.toBe(parsed.accountId);
  });

  it('rejects a suspension with no reason — the case ADR-037 refuses', () => {
    expect(() => accountStatusChangedSchema.parse(event({ reason: null }))).toThrow();
  });

  it('accepts a reactivation and rejects one that still carries a reason', () => {
    const reactivated = event({ status: 'active', previousStatus: 'suspended', reason: null });
    expect(accountStatusChangedSchema.parse(reactivated).status).toBe('active');
    expect(() => accountStatusChangedSchema.parse({ ...reactivated, reason: 'still here' })).toThrow();
  });

  it('requires a uuid actor, because a real account id is a uuid', () => {
    expect(() => accountStatusChangedSchema.parse(event({ actorId: 'admin-1' }))).toThrow();
  });

  it('accepts the system actor for a system-originated change', () => {
    expect(accountStatusChangedSchema.parse(event({ actorId: SYSTEM_ACTOR_ID })).actorId).toBe(
      SYSTEM_ACTOR_ID,
    );
  });
});

describe('suspendedAccountSchema', () => {
  it('represents one row of the lock list', () => {
    const row = suspendedAccountSchema.parse({
      accountId: SUBJECT,
      email: 'minh@skillswap.test',
      displayName: 'Minh',
      role: 'user',
      reason: 'Repeated payment fraud',
      suspendedBy: ADMIN,
      suspendedAt: '2026-10-26T09:00:00.000Z',
    });
    expect(row.reason).toBe('Repeated payment fraud');
  });

  it('allows a null suspendedBy for a suspension with no recorded actor', () => {
    const row = suspendedAccountSchema.parse({
      accountId: SUBJECT,
      email: 'minh@skillswap.test',
      displayName: 'Minh',
      role: 'user',
      reason: 'Legacy',
      suspendedBy: null,
      suspendedAt: '2026-10-26T09:00:00.000Z',
    });
    expect(row.suspendedBy).toBeNull();
  });

  it('does not allow an empty reason', () => {
    expect(() =>
      suspendedAccountSchema.parse({
        accountId: SUBJECT,
        email: 'minh@skillswap.test',
        displayName: 'Minh',
        role: 'user',
        reason: '',
        suspendedBy: ADMIN,
        suspendedAt: '2026-10-26T09:00:00.000Z',
      }),
    ).toThrow();
  });
});
