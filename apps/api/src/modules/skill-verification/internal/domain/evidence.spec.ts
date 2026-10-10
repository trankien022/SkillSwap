import {
  EVIDENCE_STATUSES,
  EVIDENCE_TYPES,
  EvidenceDocumentRequiredError,
  INITIAL_EVIDENCE_STATUS,
  InvalidEvidenceTypeError,
  InvalidLevelError,
  ProfileSkill,
  SKILL_EVIDENCE_EVENTS,
  SKILL_LEVELS,
  SkillEvidence,
  UnknownEvidenceStatusError,
  assertEvidenceStatus,
  assertEvidenceType,
  assertSkillLevel,
  effectiveApprovedLevel,
  isEvidenceStatus,
  isEvidenceType,
  isSkillLevel,
  levelCovers,
  type SkillEvidenceSnapshot,
} from './evidence';

describe('skill evidence domain', () => {
  const now = new Date('2026-10-11T00:00:00.000Z');

  it('declares stable levels, evidence types, statuses and event names', () => {
    expect(SKILL_LEVELS).toEqual(['beginner', 'intermediate', 'advanced', 'expert']);
    expect(EVIDENCE_TYPES).toEqual(['certificate', 'verifier_assessment']);
    expect(EVIDENCE_STATUSES).toEqual(['pending', 'approved', 'rejected', 'superseded']);
    expect(INITIAL_EVIDENCE_STATUS).toBe('pending');
    expect(SKILL_EVIDENCE_EVENTS).toEqual({ submitted: 'skill.evidence.submitted' });
  });

  it('recognises and asserts known levels, types and statuses', () => {
    expect(isSkillLevel('advanced')).toBe(true);
    expect(isSkillLevel('master')).toBe(false);
    expect(() => assertSkillLevel('master')).toThrow(InvalidLevelError);

    expect(isEvidenceType('certificate')).toBe(true);
    expect(isEvidenceType('self_claim')).toBe(false);
    expect(() => assertEvidenceType('self_claim')).toThrow(InvalidEvidenceTypeError);

    expect(isEvidenceStatus('pending')).toBe(true);
    expect(isEvidenceStatus('draft')).toBe(false);
    expect(() => assertEvidenceStatus('draft')).toThrow(UnknownEvidenceStatusError);
  });

  describe('levelCovers (AC-016 ordered comparison)', () => {
    it('treats a higher or equal level as covering the requirement', () => {
      expect(levelCovers('advanced', 'intermediate')).toBe(true);
      expect(levelCovers('intermediate', 'intermediate')).toBe(true);
      expect(levelCovers('beginner', 'intermediate')).toBe(false);
      expect(levelCovers('expert', 'expert')).toBe(true);
    });
  });

  describe('ProfileSkill', () => {
    it('starts with no effective level until approved (ADR-026 §5)', () => {
      const link = ProfileSkill.create({
        id: 'ps-1',
        accountId: 'acc-1',
        skillId: 'skill-1',
        createdAt: now,
      });
      expect(link.approvedLevel).toBeNull();
      expect(link.hasApproval).toBe(false);
    });

    it('reconstitutes a cached approved level and rejects an out-of-scale one', () => {
      const link = ProfileSkill.reconstitute({
        id: 'ps-1',
        accountId: 'acc-1',
        skillId: 'skill-1',
        approvedLevel: 'advanced',
        createdAt: now,
        updatedAt: now,
      });
      expect(link.approvedLevel).toBe('advanced');
      expect(link.hasApproval).toBe(true);
      expect(() =>
        ProfileSkill.reconstitute({
          id: 'ps-1',
          accountId: 'acc-1',
          skillId: 'skill-1',
          approvedLevel: 'master' as never,
          createdAt: now,
          updatedAt: now,
        }),
      ).toThrow(InvalidLevelError);
    });
  });

  describe('SkillEvidence.submit', () => {
    it('creates a pending version with the requested level and no approval yet', () => {
      const evidence = SkillEvidence.submit({
        id: 'ev-1',
        profileSkillId: 'ps-1',
        evidenceType: 'certificate',
        documentRef: 'docs/cert.pdf',
        version: 1,
        requestedLevel: 'intermediate',
        submittedAt: now,
      });
      expect(evidence.status).toBe('pending');
      expect(evidence.version).toBe(1);
      expect(evidence.requestedLevel).toBe('intermediate');
      expect(evidence.approvedLevel).toBeNull();
      expect(evidence.isPending).toBe(true);
    });

    it('requires a document for a certificate but allows a described assessment', () => {
      expect(() =>
        SkillEvidence.submit({
          id: 'ev-1',
          profileSkillId: 'ps-1',
          evidenceType: 'certificate',
          version: 1,
          requestedLevel: 'advanced',
          submittedAt: now,
        }),
      ).toThrow(EvidenceDocumentRequiredError);

      const assessment = SkillEvidence.submit({
        id: 'ev-2',
        profileSkillId: 'ps-1',
        evidenceType: 'verifier_assessment',
        description: 'Reviewed portfolio',
        version: 1,
        requestedLevel: 'advanced',
        submittedAt: now,
      });
      expect(assessment.documentRef).toBeNull();
      expect(assessment.description).toBe('Reviewed portfolio');
    });

    it('rejects a non-positive version and an out-of-scale requested level', () => {
      expect(() =>
        SkillEvidence.submit({
          id: 'ev-1',
          profileSkillId: 'ps-1',
          evidenceType: 'certificate',
          documentRef: 'docs/cert.pdf',
          version: 0,
          requestedLevel: 'advanced',
          submittedAt: now,
        }),
      ).toThrow(RangeError);

      expect(() =>
        SkillEvidence.submit({
          id: 'ev-1',
          profileSkillId: 'ps-1',
          evidenceType: 'certificate',
          documentRef: 'docs/cert.pdf',
          version: 1,
          requestedLevel: 'master' as never,
          submittedAt: now,
        }),
      ).toThrow(InvalidLevelError);
    });
  });

  describe('effectiveApprovedLevel / AC-016 replacement keeps prior approval', () => {
    const snapshot = (over: Partial<SkillEvidenceSnapshot>): SkillEvidenceSnapshot => ({
      id: 'ev',
      profileSkillId: 'ps-1',
      evidenceType: 'certificate',
      documentRef: 'docs/cert.pdf',
      description: null,
      version: 1,
      requestedLevel: 'intermediate',
      approvedLevel: null,
      status: 'pending',
      reviewerId: null,
      reason: null,
      decidedAt: null,
      submittedAt: now,
      ...over,
    });

    it('returns the approved level of the latest approved version', () => {
      expect(
        effectiveApprovedLevel([snapshot({ version: 1, status: 'approved', approvedLevel: 'intermediate' })]),
      ).toBe('intermediate');
    });

    it('keeps a prior approval while a replacement is pending or rejected', () => {
      expect(
        effectiveApprovedLevel([
          snapshot({ id: 'ev-1', version: 1, status: 'approved', approvedLevel: 'intermediate' }),
          snapshot({ id: 'ev-2', version: 2, status: 'pending', requestedLevel: 'advanced' }),
        ]),
      ).toBe('intermediate');

      expect(
        effectiveApprovedLevel([
          snapshot({ id: 'ev-1', version: 1, status: 'approved', approvedLevel: 'intermediate' }),
          snapshot({ id: 'ev-2', version: 2, status: 'rejected', requestedLevel: 'advanced' }),
        ]),
      ).toBe('intermediate');
    });

    it('returns null when nothing is approved yet', () => {
      expect(effectiveApprovedLevel([snapshot({ status: 'pending' })])).toBeNull();
      expect(effectiveApprovedLevel([])).toBeNull();
    });
  });
});
