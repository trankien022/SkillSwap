import { randomUUID } from 'node:crypto';
import { SYSTEM_ACTOR_ID, type SkillEvidenceEvent } from '@skillswap/contracts';
import { startHarness, type Harness } from './harness';
import { PostgresProcessedEventStore } from '../src/shared/messaging/processed-event-store';
import { ModuleDataSourceRegistry } from '../src/shared/messaging/module-registry';
import { orderingKeyOf } from '../src/shared/messaging/event-sequence';
import { ProjectTeacherTrustUseCase } from '../src/modules/live-class/internal/application/project-teacher-trust.use-case';
import { TEACHER_TRUST_WRITER, type TeacherTrustWriter } from '../src/modules/live-class/internal/application/port/out/account-trust';

jest.setTimeout(60_000);

/** Independent producer counters must not suppress a teacher's approved skill. */
describe('E2E: independent teacher trust streams', () => {
  let harness: Harness;
  let project: ProjectTeacherTrustUseCase;
  const accountId = randomUUID();
  const profileA = randomUUID();
  const profileB = randomUUID();
  const skillA = randomUUID();
  const skillB = randomUUID();
  const markers: string[] = [];

  beforeAll(async () => {
    harness = await startHarness();
    project = new ProjectTeacherTrustUseCase(harness.resolve<TeacherTrustWriter>(TEACHER_TRUST_WRITER));
  });

  afterAll(async () => {
    if (!harness) return;
    try {
      await harness.query('live-class', 'DELETE FROM teacher_verified WHERE account_id = $1', [accountId]);
      await harness.query('live-class', 'DELETE FROM teacher_skill_approval WHERE account_id = $1', [accountId]);
      await harness.query('live-class', 'DELETE FROM processed_events WHERE id = ANY($1::text[])', [markers]);
    } finally { await harness.close(); }
  });

  async function deliver(type: string, payload: unknown, sequence: number, handler: () => Promise<void>) {
    const id = randomUUID();
    const key = orderingKeyOf(type, payload);
    markers.push(`live-class:${id}`, `live-class:seq:${key}`);
    // A fresh store forces the guard to read PostgreSQL, just as after a restart.
    const store = new PostgresProcessedEventStore(harness.resolve<ModuleDataSourceRegistry>(ModuleDataSourceRegistry));
    await store.runOnce('live-class', 'live-class', id, handler, { aggregateId: key, sequence });
  }

  function skillEvent(profileSkillId: string, skillId: string, occurredAt: number): SkillEvidenceEvent {
    return {
      accountId, profileSkillId, skillId, evidenceId: randomUUID(), version: 1,
      status: 'approved', requestedLevel: 'beginner', approvedLevel: 'beginner',
      reason: null, actorId: SYSTEM_ACTOR_ID, occurredAt: new Date(occurredAt).toISOString(),
    };
  }

  it('applies a lower skill sequence after student approval and an unrelated skill', async () => {
    const now = Date.now();
    const verification = {
      accountId, verificationId: randomUUID(), status: 'approved' as const,
      schoolName: 'Ordering regression fixture', reason: null,
      actorId: SYSTEM_ACTOR_ID, occurredAt: new Date(now).toISOString(),
    };
    await deliver('student.verification.approved', verification, 100, () => project.onVerification(verification));
    const b = skillEvent(profileB, skillB, now + 1);
    const a = skillEvent(profileA, skillA, now + 2);
    await deliver('skill.evidence.approved', b, 20, () => project.onSkillEvidence(b));
    await deliver('skill.evidence.approved', a, 2, () => project.onSkillEvidence(a));
    const rows = await harness.query<{ skill_id: string; approved_level: string }>('live-class',
      'SELECT skill_id, approved_level FROM teacher_skill_approval WHERE account_id = $1', [accountId]);
    expect(rows).toEqual(expect.arrayContaining([
      { skill_id: skillA, approved_level: 'beginner' },
      { skill_id: skillB, approved_level: 'beginner' },
    ]));
  });

  it('still rejects a stale update within the same profile skill after restart', async () => {
    const newest = { ...skillEvent(profileA, skillA, Date.now() + 1000), approvedLevel: 'advanced' as const };
    await deliver('skill.evidence.approved', newest, 4, () => project.onSkillEvidence(newest));
    const stale = { ...skillEvent(profileA, skillA, Date.now() + 2000), status: 'rejected' as const, approvedLevel: null };
    await deliver('skill.evidence.rejected', stale, 3, () => project.onSkillEvidence(stale));
    const rows = await harness.query<{ approved_level: string }>('live-class',
      'SELECT approved_level FROM teacher_skill_approval WHERE account_id = $1 AND skill_id = $2', [accountId, skillA]);
    expect(rows).toEqual([{ approved_level: 'advanced' }]);
  });
});
