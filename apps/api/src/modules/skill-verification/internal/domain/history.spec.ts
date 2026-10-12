import {
  EVIDENCE_AUDIT_ACTIONS,
  isEvidenceAuditAction,
  type EvidenceAuditEntry,
  type EvidenceVersionHistory,
} from './history';

describe('evidence history domain (FR-018 / ADR-028)', () => {
  it('declares the audit actions that append history', () => {
    expect(EVIDENCE_AUDIT_ACTIONS).toEqual(['submitted', 'claimed', 'approved', 'rejected', 'superseded']);
  });

  it('recognises known audit actions', () => {
    expect(isEvidenceAuditAction('approved')).toBe(true);
    expect(isEvidenceAuditAction('expired')).toBe(false);
  });

  it('groups entries per version, newest version first', () => {
    const entry = (version: number, action: EvidenceAuditEntry['action']): EvidenceAuditEntry => ({
      id: `a-${version}-${action}`,
      evidenceId: `ev-${version}`,
      profileSkillId: 'ps-1',
      version,
      action,
      actorId: 'vf-1',
      fromStatus: 'pending',
      toStatus: 'approved',
      reason: null,
      snapshot: {
        version,
        status: 'approved',
        evidenceType: 'certificate',
        requestedLevel: 'intermediate',
        approvedLevel: 'intermediate',
        reason: null,
      },
      occurredAt: new Date('2026-10-11T00:00:00.000Z'),
      traceId: null,
    });

    const history: EvidenceVersionHistory[] = [
      { version: 2, evidenceId: 'ev-2', currentStatus: 'approved', requestedLevel: 'advanced', approvedLevel: 'advanced', submittedAt: new Date(), entries: [entry(2, 'approved')] },
      { version: 1, evidenceId: 'ev-1', currentStatus: 'superseded', requestedLevel: 'intermediate', approvedLevel: 'intermediate', submittedAt: new Date(), entries: [entry(1, 'approved'), entry(1, 'superseded')] },
    ];

    expect(history[0].version).toBe(2);
    expect(history[1].entries.map((e) => e.action)).toEqual(['approved', 'superseded']);
  });
});
