import { GetAdminDashboardQueryHandler, RECENT_AUDIT_EVENT_LIMIT } from './get-admin-dashboard.query';
import type { EvidenceSummaryReader } from '../../../../skill-verification/api';
import type { VerificationSummaryReader } from '../../../../student-verification/api';
import type {
  AdminAuditEventRepository,
  AdminAuditPage,
  AdminAuditQuery,
} from '../port/out/admin-audit-event-repository';
import type { AuditEvent } from '@skillswap/contracts';

/**
 * FR-015 / ADR-034 §7: the dashboard composition.
 *
 * The pieces are stubbed individually because the composition is the thing under test: does the
 * handler take the counts from the modules that own them, ask for the newest audit events, and
 * stamp the read? A handler that got the wiring wrong (wrong source, wrong sort, stale stamp)
 * would still return an `AdminDashboard`-shaped object, so each field is asserted to come from its
 * documented source rather than merely to be present.
 */

const verificationReader = (byStatus: Record<string, number>): VerificationSummaryReader => ({
  read: jest.fn().mockResolvedValue({
    byStatus,
    total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
  }),
});

const evidenceReader = (
  byStatus: Record<string, number>,
  byDomain: Record<string, number>,
): EvidenceSummaryReader => ({
  read: jest.fn().mockResolvedValue({
    byStatus,
    byDomain,
    total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
  }),
});

class StubAuditRepository implements AdminAuditEventRepository {
  lastQuery: AdminAuditQuery | null = null;
  items: AuditEvent[] = [];

  async append(): Promise<boolean> {
    return true;
  }

  async list(query: AdminAuditQuery): Promise<AdminAuditPage> {
    this.lastQuery = query;
    return { items: this.items, nextCursor: null, total: this.items.length };
  }
}

function auditEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'a-1',
    actorId: 'admin-1',
    action: 'skill.verifier.suspended',
    targetType: 'verifier_account',
    targetId: 'vf-1',
    oldState: null,
    newState: null,
    occurredAt: '2026-10-15T00:00:00.000Z',
    traceId: null,
    metadata: null,
    sourceEventId: 'evt-1',
    ...overrides,
  };
}

const FIXED_NOW = new Date('2026-10-15T12:00:00.000Z');

function handler(
  verifications: VerificationSummaryReader,
  evidence: EvidenceSummaryReader,
  audit: AdminAuditEventRepository,
): GetAdminDashboardQueryHandler {
  return new GetAdminDashboardQueryHandler(verifications, evidence, audit, {
    now: () => FIXED_NOW,
  });
}

const VERIFICATION_COUNTS = { pending: 3, approved: 5, rejected: 1, revoked: 2 };
const EVIDENCE_COUNTS = { pending: 4, claimed: 2, approved: 9, rejected: 1, superseded: 1 };

describe('GetAdminDashboardQueryHandler', () => {
  it('takes the verification counts from the student-verification reader', async () => {
    const result = await handler(
      verificationReader(VERIFICATION_COUNTS),
      evidenceReader(EVIDENCE_COUNTS, {}),
      new StubAuditRepository(),
    ).execute();

    expect(result.verifications).toEqual(VERIFICATION_COUNTS);
  });

  it('takes the evidence counts and domain split from the skill-verification reader', async () => {
    const result = await handler(
      verificationReader(VERIFICATION_COUNTS),
      evidenceReader(EVIDENCE_COUNTS, { Programming: 4, Languages: 2 }),
      new StubAuditRepository(),
    ).execute();

    expect(result.evidence).toEqual(EVIDENCE_COUNTS);
    expect(result.evidenceByDomain).toEqual({ Programming: 4, Languages: 2 });
  });

  it('asks the audit store for the newest events', async () => {
    const audit = new StubAuditRepository();
    audit.items = [auditEvent({ id: 'a-9' }), auditEvent({ id: 'a-8' })];

    const result = await handler(
      verificationReader(VERIFICATION_COUNTS),
      evidenceReader(EVIDENCE_COUNTS, {}),
      audit,
    ).execute();

    expect(audit.lastQuery?.sort).toBe('-occurredAt');
    expect(audit.lastQuery?.limit).toBe(RECENT_AUDIT_EVENT_LIMIT);
    expect(result.recentAuditEvents.map((event) => event.id)).toEqual(['a-9', 'a-8']);
  });

  it('stamps the read time so a client can show freshness', async () => {
    const result = await handler(
      verificationReader(VERIFICATION_COUNTS),
      evidenceReader(EVIDENCE_COUNTS, {}),
      new StubAuditRepository(),
    ).execute();

    expect(result.generatedAt).toBe('2026-10-15T12:00:00.000Z');
  });

  it('reads the three sources concurrently', async () => {
    const order: string[] = [];
    const verifications: VerificationSummaryReader = {
      read: jest.fn(async () => {
        order.push('verifications:start');
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('verifications:end');
        return { byStatus: VERIFICATION_COUNTS as never, total: 11 };
      }),
    };
    const evidence: EvidenceSummaryReader = {
      read: jest.fn(async () => {
        order.push('evidence:start');
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('evidence:end');
        return { byStatus: EVIDENCE_COUNTS as never, byDomain: {}, total: 17 };
      }),
    };
    const audit = new StubAuditRepository();

    await handler(verifications, evidence, audit).execute();

    // Both slow reads must have started before either finished; a sequential composition would
    // show `verifications:end` before `evidence:start`.
    expect(order.slice(0, 2).sort()).toEqual(['evidence:start', 'verifications:start']);
  });

  it('returns a dashboard even when every source is empty', async () => {
    const result = await handler(
      verificationReader({ pending: 0, approved: 0, rejected: 0, revoked: 0 }),
      evidenceReader(
        { pending: 0, claimed: 0, approved: 0, rejected: 0, superseded: 0 },
        {},
      ),
      new StubAuditRepository(),
    ).execute();

    expect(result.recentAuditEvents).toEqual([]);
    expect(result.evidenceByDomain).toEqual({});
    expect(result.generatedAt).toBe('2026-10-15T12:00:00.000Z');
  });
});
