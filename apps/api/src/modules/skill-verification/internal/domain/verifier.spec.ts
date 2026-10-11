import {
  InactiveVerifierError,
  INITIAL_VERIFIER_STATUS,
  InvalidVerifierTransitionError,
  OutOfExpertiseError,
  SelfDecisionError,
  VERIFIER_EVENTS,
  VERIFIER_STATUSES,
  UnknownVerifierStatusError,
  assertMayDecide,
  assertVerifierStatus,
  assertVerifierTransition,
  canChangeVerifierStatus,
  hasExpertise,
  isVerifierStatus,
  mayDecide,
  type Verifier,
} from './verifier';

function verifier(over: Partial<Verifier> = {}): Verifier {
  return { accountId: 'vf-1', status: 'active', expertise: ['sk-react', 'sk-ielts'], ...over };
}

describe('verifier domain (FR-004 / ADR-027)', () => {
  it('declares stable statuses and event names', () => {
    expect(VERIFIER_STATUSES).toEqual(['active', 'suspended', 'revoked']);
    expect(INITIAL_VERIFIER_STATUS).toBe('active');
    expect(VERIFIER_EVENTS).toEqual({
      suspended: 'skill.verifier.suspended',
      revoked: 'skill.verifier.revoked',
    });
  });

  it('recognises and asserts known statuses', () => {
    expect(isVerifierStatus('active')).toBe(true);
    expect(isVerifierStatus('nope')).toBe(false);
    expect(() => assertVerifierStatus('nope')).toThrow(UnknownVerifierStatusError);
  });

  it('allows active↔suspended and revoke, but never leaves revoked', () => {
    expect(canChangeVerifierStatus('active', 'suspended')).toBe(true);
    expect(canChangeVerifierStatus('suspended', 'active')).toBe(true);
    expect(canChangeVerifierStatus('active', 'revoked')).toBe(true);
    expect(canChangeVerifierStatus('revoked', 'active')).toBe(false);
    expect(() => assertVerifierTransition('revoked', 'active')).toThrow(InvalidVerifierTransitionError);
  });

  it('matches expertise by skill membership', () => {
    expect(hasExpertise(verifier(), 'sk-react')).toBe(true);
    expect(hasExpertise(verifier(), 'sk-guitar')).toBe(false);
  });

  describe('mayDecide / assertMayDecide (AC-018)', () => {
    it('accepts an active, expertise-matched, non-owner Verifier', () => {
      expect(mayDecide(verifier(), { skillId: 'sk-react', ownerId: 'acc-teacher' })).toBe(true);
      expect(() =>
        assertMayDecide(verifier(), { skillId: 'sk-react', ownerId: 'acc-teacher' }),
      ).not.toThrow();
    });

    it('rejects an inactive Verifier', () => {
      expect(mayDecide(verifier({ status: 'suspended' }), { skillId: 'sk-react', ownerId: 'x' })).toBe(false);
      expect(() => assertMayDecide(verifier({ status: 'suspended' }), { skillId: 'sk-react', ownerId: 'x' }))
        .toThrow(InactiveVerifierError);
      expect(() => assertMayDecide(verifier({ status: 'revoked' }), { skillId: 'sk-react', ownerId: 'x' }))
        .toThrow(InactiveVerifierError);
    });

    it('rejects an out-of-expertise skill', () => {
      expect(mayDecide(verifier(), { skillId: 'sk-guitar', ownerId: 'x' })).toBe(false);
      expect(() => assertMayDecide(verifier(), { skillId: 'sk-guitar', ownerId: 'x' })).toThrow(
        OutOfExpertiseError,
      );
    });

    it("rejects the Verifier's own evidence (BR-012)", () => {
      expect(mayDecide(verifier(), { skillId: 'sk-react', ownerId: 'vf-1' })).toBe(false);
      expect(() => assertMayDecide(verifier(), { skillId: 'sk-react', ownerId: 'vf-1' })).toThrow(
        SelfDecisionError,
      );
    });

    it('ignores an Administrator role (BR-065): authority comes only from active + expertise', () => {
      // The domain has no admin concept; a non-expert account (even if admin elsewhere) fails.
      expect(mayDecide(verifier({ expertise: [] }), { skillId: 'sk-react', ownerId: 'x' })).toBe(false);
    });
  });
});
