import {
  SYSTEM_ACTOR_ID,
  bookingConfirmedSchema,
  classStartingSoonSchema,
  isSystemActor,
  skillEvidenceEventSchema,
  studentVerificationEventSchema,
  verifierStatusChangedSchema,
  walletTransactionCompletedEventSchema,
} from './index';

/**
 * ADR-035: the audited events carry their actor, and carry it **required**.
 *
 * The enforcement that matters is the rejection, not the acceptance: an optional `actorId` would
 * let a future producer forget it and write an unattributed audit row indistinguishable from a
 * legacy one. A required field fails schema validation at publish time instead, where the relay
 * records it as a `DEAD` row (ADR-013 Amendment A, C2) — visible, rather than absent.
 */

const VERIFIER = '8a1e0000-0000-4000-8000-000000000a1b';
const ADMIN = '8a1e0000-0000-4000-8000-000000000b2c';
const LEARNER = '8a1e0000-0000-4000-8000-000000000c3d';
const CLASS_ID = '8a1e0000-0000-4000-8000-000000000d4e';
const NOW = '2026-10-25T10:00:00.000Z';

interface AuditedCase {
  schema: { parse: (value: unknown) => unknown };
  payload: Record<string, unknown>;
}

/** Every audited payload, minimal and valid, keyed by the event family it belongs to. */
const AUDITED: Record<string, AuditedCase> = {
  'student.verification.approved': {
    schema: studentVerificationEventSchema,
    payload: {
      verificationId: 'v-1',
      accountId: LEARNER,
      status: 'approved',
      schoolName: 'FPT University',
      reason: null,
      occurredAt: NOW,
      actorId: ADMIN,
    },
  },
  'skill.evidence.claimed': {
    schema: skillEvidenceEventSchema,
    payload: {
      evidenceId: 'e-1',
      profileSkillId: 'ps-1',
      accountId: LEARNER,
      skillId: 'skill-guitar',
      version: 1,
      requestedLevel: 'advanced',
      status: 'claimed',
      occurredAt: NOW,
      actorId: VERIFIER,
    },
  },
  'skill.evidence.approved': {
    schema: skillEvidenceEventSchema,
    payload: {
      evidenceId: 'e-1',
      profileSkillId: 'ps-1',
      accountId: LEARNER,
      skillId: 'skill-guitar',
      version: 1,
      requestedLevel: 'advanced',
      status: 'approved',
      approvedLevel: 'advanced',
      reason: null,
      occurredAt: NOW,
      actorId: VERIFIER,
    },
  },
  'skill.verifier.suspended': {
    schema: verifierStatusChangedSchema,
    payload: {
      verifierId: VERIFIER,
      status: 'suspended',
      previousStatus: 'active',
      occurredAt: NOW,
      actorId: ADMIN,
    },
  },
  'wallet.transaction.completed': {
    schema: walletTransactionCompletedEventSchema,
    payload: {
      transactionId: 't-1',
      accountId: LEARNER,
      type: 'top_up',
      amountCredits: 100,
      direction: 'credit',
      occurredAt: NOW,
      actorId: SYSTEM_ACTOR_ID,
    },
  },
};

describe('ADR-035: audited events carry their actor', () => {
  it.each(Object.keys(AUDITED))('accepts %s when the actor is present', (eventType) => {
    const { schema, payload } = AUDITED[eventType]!;
    expect(schema.parse(payload)).toBeDefined();
  });

  it.each(Object.keys(AUDITED))(
    'refuses %s when the producer forgets the actor',
    (eventType) => {
      const { schema, payload } = AUDITED[eventType]!;
      const withoutActor: Record<string, unknown> = { ...payload };
      delete withoutActor.actorId;
      expect(() => schema.parse(withoutActor)).toThrow();
    },
  );

  it('refuses an actor that is not a uuid, instead of storing a name or an email', () => {
    const { schema, payload } = AUDITED['skill.evidence.approved']!;
    expect(() => schema.parse({ ...payload, actorId: 'verifier@skillswap.test' })).toThrow();
    expect(() => schema.parse({ ...payload, actorId: null })).toThrow();
  });

  it('accepts the system actor, so an automatic action is attributable', () => {
    expect(SYSTEM_ACTOR_ID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(isSystemActor(SYSTEM_ACTOR_ID)).toBe(true);
    expect(isSystemActor(ADMIN)).toBe(false);
    // NULL means "legacy or unknown" (ADR-035 C3); it is not the system.
    expect(isSystemActor(null)).toBe(false);
    expect(isSystemActor(undefined)).toBe(false);
  });

  it('leaves events that are not privileged acts alone', () => {
    // ADR-035 point 1 names these explicitly. `booking.confirmed` is a user doing what the
    // product already lets them do; a reminder is an effect of time. If either gained a required
    // actorId, every emitter would change for no audit benefit.
    expect(() =>
      bookingConfirmedSchema.parse({
        bookingId: 'b-1',
        studentId: LEARNER,
        teacherId: ADMIN,
        amountCredits: 10,
      }),
    ).not.toThrow();
    expect(() =>
      classStartingSoonSchema.parse({
        classId: CLASS_ID,
        startsAt: NOW,
        participants: [{ accountId: LEARNER, role: 'learner' }],
      }),
    ).not.toThrow();
  });
});
