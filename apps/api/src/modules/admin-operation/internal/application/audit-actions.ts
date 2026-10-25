import {
  skillEvidenceEventSchema,
  studentVerificationEventSchema,
  verifierStatusChangedSchema,
  walletTransactionCompletedEventSchema,
} from '@skillswap/contracts';
import type { AdminAuditEventInput, AuditableMessage } from '../domain/audit-event';

/**
 * FR-015 / ADR-034 §3: the mapping table from a domain event to an audit row.
 *
 * **Why the event names are literals here.** `module-isolation-*` (ADR-005/ADR-011) forbids code
 * outside a module from importing that module's internals, so this consumer cannot import
 * `VERIFICATION_EVENTS` or `SKILL_EVIDENCE_EVENTS`. That constraint is not an obstacle to work
 * around — it is the correct shape for a downstream projection: the audit log is deliberately
 * **decoupled** from the modules it observes, coupled only to the published contract
 * (`packages/contracts`), which is what ADR-013 establishes. If a module renames an event, this
 * table stops matching and the tests below fail loudly, which is the intended failure mode.
 *
 * **Why the table is closed and hand-written.** Not every event is a privileged action: a
 * `booking.confirmed` is a user doing what the product already lets them do, while an
 * administrator suspending a Verifier is exactly what an audit log exists to account for.
 * Publishing everything would bury the signal. And each row's `oldState`/`newState` is a
 * *decision*, not a copy — ADR-034 §3 and NFR-005 require whitelisted scalars, so a field is
 * included because someone chose it, never because a future payload happened to gain it.
 *
 * Returning `null` means "not audited". The consumer ignores those rather than failing, because
 * failing would poison the shared queue for every other consumer of the same event.
 */

/** The published event types this module audits (ADR-034 §5). */
export const AUDITED_EVENT_TYPES = {
  verificationApproved: 'student.verification.approved',
  verificationRejected: 'student.verification.rejected',
  verificationRevoked: 'student.verification.revoked',
  evidenceClaimed: 'skill.evidence.claimed',
  evidenceApproved: 'skill.evidence.approved',
  evidenceRejected: 'skill.evidence.rejected',
  verifierSuspended: 'skill.verifier.suspended',
  verifierRevoked: 'skill.verifier.revoked',
  walletTransactionCompleted: 'wallet.transaction.completed',
} as const;

/** Every event type this module subscribes to, derived from the table above so they cannot drift. */
export const AUDITED_EVENT_TYPE_LIST: readonly string[] = Object.values(AUDITED_EVENT_TYPES);

export function describeAuditedAction(message: AuditableMessage): AdminAuditEventInput | null {
  const { eventType, id: sourceEventId, payload } = message;

  switch (eventType) {
    // --- FR-002 / FR-019: student-verification decisions ----------------------
    case AUDITED_EVENT_TYPES.verificationApproved:
    case AUDITED_EVENT_TYPES.verificationRejected:
    case AUDITED_EVENT_TYPES.verificationRevoked: {
      const event = studentVerificationEventSchema.parse(payload);
      return {
        // ADR-035: the Administrator who decided, carried on the event by the emitter. Rows
        // written before ADR-035 have null here; that seam is deliberate (C3, no backfill).
        actorId: event.actorId,
        action: eventType,
        targetType: 'verification',
        targetId: event.verificationId,
        oldState: null,
        newState: {
          status: event.status,
          schoolName: event.schoolName,
          reason: event.reason ?? null,
        },
        occurredAt: new Date(event.occurredAt),
        traceId: null,
        metadata: null,
        sourceEventId,
      };
    }

    // --- FR-004 / BR-013: skill-evidence claim and decision -------------------
    case AUDITED_EVENT_TYPES.evidenceClaimed:
    case AUDITED_EVENT_TYPES.evidenceApproved:
    case AUDITED_EVENT_TYPES.evidenceRejected: {
      const event = skillEvidenceEventSchema.parse(payload);
      return {
        // ADR-035: the account that acted — the submitter, the claimant, or the decider.
        actorId: event.actorId,
        action: eventType,
        targetType: 'skill_evidence',
        targetId: event.evidenceId,
        oldState: null,
        newState: {
          status: event.status,
          skillId: event.skillId,
          version: event.version,
          requestedLevel: event.requestedLevel,
          approvedLevel: event.approvedLevel ?? null,
          reason: event.reason ?? null,
        },
        occurredAt: new Date(event.occurredAt),
        traceId: null,
        metadata: { profileSkillId: event.profileSkillId },
        sourceEventId,
      };
    }

    // --- FR-004 / ADR-027: Administrator changes a Verifier's status ----------
    case AUDITED_EVENT_TYPES.verifierSuspended:
    case AUDITED_EVENT_TYPES.verifierRevoked: {
      const event = verifierStatusChangedSchema.parse(payload);
      return {
        // ADR-035: the Administrator who demoted them. `targetId` is the Verifier; this is
        // the person who acted, and they are deliberately different accounts.
        actorId: event.actorId,
        action: eventType,
        targetType: 'verifier_account',
        targetId: event.verifierId,
        // The old→new pair is the whole point of this row: who was demoted, from what.
        oldState: { status: event.previousStatus },
        newState: { status: event.status },
        occurredAt: new Date(event.occurredAt),
        traceId: null,
        metadata: null,
        sourceEventId,
      };
    }

    // --- FR-014 / ADR-031: financial transitions ------------------------------
    case AUDITED_EVENT_TYPES.walletTransactionCompleted: {
      const event = walletTransactionCompletedEventSchema.parse(payload);
      return {
        // ADR-035: usually SYSTEM_ACTOR_ID (a settlement), never the beneficiary — that is
        // `event.accountId`, which stays in the payload and is not the actor.
        actorId: event.actorId,
        action: eventType,
        targetType: 'wallet_transaction',
        targetId: event.transactionId,
        oldState: null,
        newState: {
          type: event.type,
          direction: event.direction,
          // Money is integer credits everywhere (AGENTS.md); the row stores the integer it was
          // given and never a derived or rounded value.
          amountCredits: event.amountCredits,
        },
        occurredAt: new Date(event.occurredAt),
        traceId: null,
        metadata: event.bookingId === undefined ? null : { bookingId: event.bookingId },
        sourceEventId,
      };
    }

    default:
      return null;
  }
}
