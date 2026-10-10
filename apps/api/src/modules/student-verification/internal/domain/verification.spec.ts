import {
  DuplicateActiveVerificationError,
  EFFECTIVE_STATUSES,
  INITIAL_VERIFICATION_STATUS,
  InvalidDeciderError,
  InvalidRevocationError,
  InvalidVerificationTransitionError,
  ReasonRequiredError,
  VERIFICATION_EVENTS,
  VERIFICATION_STATUSES,
  Verification,
  UnknownVerificationStatusError,
  assertDecidable,
  assertVerificationStatus,
  canDecide,
  canRevoke,
  decideVerification,
  hasVerifiedRights,
  isEffectiveStatus,
  isVerificationStatus,
  revokeVerification,
} from './verification';

describe('student verification domain', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');

  it('declares stable statuses and event names', () => {
    expect(VERIFICATION_STATUSES).toEqual(['pending', 'approved', 'rejected', 'revoked']);
    expect(EFFECTIVE_STATUSES).toEqual(['pending', 'approved']);
    expect(INITIAL_VERIFICATION_STATUS).toBe('pending');
    expect(VERIFICATION_EVENTS).toEqual({
      submitted: 'student.verification.submitted',
      approved: 'student.verification.approved',
      rejected: 'student.verification.rejected',
      revoked: 'student.verification.revoked',
    });
  });

  it('recognises and asserts known statuses', () => {
    expect(isVerificationStatus('pending')).toBe(true);
    expect(isVerificationStatus('bogus')).toBe(false);
    expect(() => assertVerificationStatus('bogus')).toThrow(UnknownVerificationStatusError);
    expect(() => assertVerificationStatus('approved')).not.toThrow();
  });

  it('classifies effective statuses (SR-BR-011)', () => {
    expect(isEffectiveStatus('pending')).toBe(true);
    expect(isEffectiveStatus('approved')).toBe(true);
    expect(isEffectiveStatus('rejected')).toBe(false);
    expect(isEffectiveStatus('revoked')).toBe(false);
  });

  it('grants VERIFIED rights only for approved (FR-019)', () => {
    expect(hasVerifiedRights('approved')).toBe(true);
    expect(hasVerifiedRights('pending')).toBe(false);
    expect(hasVerifiedRights('rejected')).toBe(false);
    expect(hasVerifiedRights('revoked')).toBe(false);
  });

  it('allows only pending to be decided', () => {
    expect(canDecide('pending', 'approved')).toBe(true);
    expect(canDecide('pending', 'rejected')).toBe(true);
    expect(canDecide('approved', 'approved')).toBe(false);
    expect(canDecide('rejected', 'approved')).toBe(false);
    expect(() => assertDecidable('approved', 'rejected')).toThrow(InvalidVerificationTransitionError);
  });

  it('revokes only effective verifications (FR-019)', () => {
    expect(canRevoke('pending')).toBe(true);
    expect(canRevoke('approved')).toBe(true);
    expect(canRevoke('rejected')).toBe(false);
    expect(canRevoke('revoked')).toBe(false);
  });

  it('starts a submission as pending with no decision fields', () => {
    const v = Verification.submit({
      id: 'v1',
      accountId: 'a1',
      schoolName: '  FPT University  ',
      major: '  SE  ',
      documentRef: 'doc-ref-1',
      submittedAt: now,
    });
    expect(v.status).toBe('pending');
    expect(v.schoolName).toBe('FPT University');
    expect(v.major).toBe('SE');
    expect(v.reviewerId).toBeNull();
    expect(v.reason).toBeNull();
    expect(v.submittedAt).toBe(now);
    expect(v.isEffective).toBe(true);
  });

  it('rejects an empty school name', () => {
    expect(() =>
      Verification.submit({
        id: 'v1',
        accountId: 'a1',
        schoolName: '   ',
        documentRef: 'd',
        submittedAt: now,
      }),
    ).toThrow(RangeError);
  });

  it('requires the decider to be an Administrator', () => {
    expect(() =>
      decideVerification('pending', { decision: 'approve' }, { reviewerRole: 'learner', reviewerId: 'u1', now }),
    ).toThrow(InvalidDeciderError);
  });

  it('requires a reason when rejecting (AC-012)', () => {
    expect(() =>
      decideVerification('pending', { decision: 'reject' }, { reviewerRole: 'admin', reviewerId: 'admin', now }),
    ).toThrow(ReasonRequiredError);
    expect(() =>
      decideVerification('pending', { decision: 'reject', reason: '  ' }, { reviewerRole: 'admin', reviewerId: 'admin', now }),
    ).toThrow(ReasonRequiredError);
  });

  it('records the reviewer, reason and decided-at on rejection', () => {
    const decision = decideVerification(
      'pending',
      { decision: 'reject', reason: ' illegible document ' },
      { reviewerRole: 'admin', reviewerId: 'admin-1', now },
    );
    expect(decision).toEqual({
      status: 'rejected',
      reason: 'illegible document',
      decidedAt: now,
      reviewerId: 'admin-1',
    });
  });

  it('approves without an expiry (ADR-023: no expiry in the MVP)', () => {
    const decision = decideVerification(
      'pending',
      { decision: 'approve', major: 'Software Engineering' },
      { reviewerRole: 'admin', reviewerId: 'admin-1', now },
    );
    expect(decision.status).toBe('approved');
    expect(decision.reviewerId).toBe('admin-1');
    expect(decision.major).toBe('Software Engineering');
    expect(decision).not.toHaveProperty('expiresAt');
  });

  it('never decidable from a terminal status', () => {
    expect(() =>
      decideVerification('rejected', { decision: 'approve' }, { reviewerRole: 'admin', reviewerId: 'admin', now }),
    ).toThrow(InvalidVerificationTransitionError);
  });

  it('has no superseded status or expiry state (developer decisions)', () => {
    expect(VERIFICATION_STATUSES).not.toContain('superseded');
    const approved = Verification.reconstitute({
      id: 'v1',
      accountId: 'a1',
      schoolName: 'FPT',
      major: null,
      documentRef: 'doc',
      status: 'approved',
      reviewerId: 'admin',
      reason: null,
      decidedAt: now,
      submittedAt: now,
    });
    expect(approved.isEffective).toBe(true);
    expect(approved).not.toHaveProperty('expiresAt');
  });

  it('exposes a duplicate-active error with the account id', () => {
    const error = new DuplicateActiveVerificationError('a1');
    expect(error.name).toBe('DuplicateActiveVerificationError');
    expect(error.message).toContain('a1');
  });

  describe('revokeVerification (FR-019 / ADR-025)', () => {
    const context = { reviewerRole: 'admin' as string | undefined, reviewerId: 'admin-1', now };

    it('revokes an approved verification with a reason', () => {
      const result = revokeVerification('approved', { reason: ' fake document ' }, context);
      expect(result).toEqual({ status: 'revoked', reason: 'fake document', revokedAt: now });
    });

    it('revokes a pending verification too', () => {
      expect(revokeVerification('pending', { reason: 'fraud' }, context).status).toBe('revoked');
    });

    it('requires a reason to revoke', () => {
      expect(() => revokeVerification('approved', {}, context)).toThrow(ReasonRequiredError);
      expect(() => revokeVerification('approved', { reason: '  ' }, context)).toThrow(
        ReasonRequiredError,
      );
    });

    it('requires the admin role', () => {
      expect(() =>
        revokeVerification('approved', { reason: 'x' }, { ...context, reviewerRole: 'learner' }),
      ).toThrow(InvalidDeciderError);
    });

    it('refuses to revoke a non-effective verification', () => {
      expect(() => revokeVerification('rejected', { reason: 'x' }, context)).toThrow(
        InvalidRevocationError,
      );
      expect(() => revokeVerification('revoked', { reason: 'x' }, context)).toThrow(
        InvalidRevocationError,
      );
    });

    it('exposes the revocation reason as the display reason and drops rights', () => {
      const revoked = Verification.reconstitute({
        id: 'v1',
        accountId: 'a1',
        schoolName: 'FPT',
        major: null,
        documentRef: 'doc',
        status: 'revoked',
        reviewerId: 'admin-1',
        reason: null,
        decidedAt: now,
        submittedAt: now,
        revokedAt: now,
        revocationReason: 'fake document',
      });
      expect(revoked.displayReason).toBe('fake document');
      expect(revoked.hasVerifiedRights).toBe(false);
      expect(revoked.isEffective).toBe(false);
    });
  });
});
