import { CreateClassUseCase } from './create-class.use-case';
import type { ClassRepository, CreateClassRecord, PersistedClass } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import { InvalidCapacityError, InvalidTitleError } from '../domain/class';
import { SkillNotApprovedError, UnverifiedTeacherError } from '../domain/publish-policy';
import { FakeAccountTrustReader } from './testing/live-class-fakes';

const NOW = new Date('2026-10-08T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function setup(trust = new FakeAccountTrustReader()) {
  const calls: CreateClassRecord[] = [];
  const classes: ClassRepository = {
    insert: jest.fn(async (record: CreateClassRecord) => {
      calls.push(record);
      return { id: 'cls-new', ...record } as PersistedClass;
    }),
    findById: jest.fn(async () => null),
    update: jest.fn(async (_id: string, edit) => ({ id: _id, teacherId: 'teacher-1', state: 'published', ...edit }) as PersistedClass),
    markCancelled: jest.fn(async () => undefined),
    startAndEmit: jest.fn(async () => ({ started: false })),
    completeAndEmit: jest.fn(async () => ({ completed: false, bookingIds: [] })),
    cancelWithReason: jest.fn(async () => ({ cancelled: false })),
    findAwaitingCompletion: jest.fn(async () => []),
    findInProgressBeforeEnd: jest.fn(async () => []),
    // FR-016 (W3): not exercised here; present so this mock stays a whole ClassRepository.
    findAwaitingReminder: jest.fn(async () => []),
    claimReminderAndEmit: jest.fn(async () => ({ reminded: false, participants: 0 })),
  };
  const clock: Clock = { now: () => NOW };
  return { useCase: new CreateClassUseCase(classes, clock, trust), classes, calls };
}

function command(overrides: Partial<Parameters<CreateClassUseCase['execute']>[0]> = {}) {
  return {
    teacherId: 'teacher-1',
    skillIds: ['skill-1'],
    title: 'Guitar basics',
    description: 'Guitar',
    startsAt: new Date(NOW.getTime() + 48 * HOUR).toISOString(),
    durationMinutes: 60,
    priceCredits: 100,
    capacity: 1,
    ...overrides,
  };
}

describe('CreateClassUseCase', () => {
  it('publishes a class and returns the stored resource', async () => {
    const { useCase, calls } = setup();
    const result = await useCase.execute(command());
    expect(calls).toHaveLength(1);
    expect(calls[0].state).toBe('published');
    expect(result).toEqual({
      id: 'cls-new',
      teacherId: 'teacher-1',
      state: 'published',
      title: 'Guitar basics',
      level: 'expert',
      startsAt: new Date(NOW.getTime() + 48 * HOUR).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 1,
    });
  });

  it('records the level the publish approval implies (B2)', async () => {
    const { useCase, calls } = setup(
      new FakeAccountTrustReader({ approvedLevels: { 'skill-1': 'advanced' } }),
    );
    await useCase.execute(command());
    expect(calls[0].level).toBe('advanced');
  });

  it('takes the level from the class first skill, not from the catalogue', async () => {
    // The gate required both skills approved; the class reports the first one rather than
    // inventing an aggregate. This pins which skill wins so a later refactor cannot silently
    // change the badge.
    const { useCase, calls } = setup(
      new FakeAccountTrustReader({
        approvedLevels: { 'skill-1': 'beginner', 'skill-2': 'expert' },
      }),
    );
    await useCase.execute(command({ skillIds: ['skill-1', 'skill-2'] }));
    expect(calls[0].level).toBe('beginner');
  });

  it('rejects an invalid title before persisting (B1)', async () => {
    const { useCase, classes } = setup();
    await expect(useCase.execute(command({ title: '   ' }))).rejects.toThrow(InvalidTitleError);
    expect(classes.insert).not.toHaveBeenCalled();
  });

  it('rejects an invalid capacity before persisting (OQ-007)', async () => {
    const { useCase, classes } = setup();
    await expect(useCase.execute(command({ capacity: 0 }))).rejects.toThrow(InvalidCapacityError);
    expect(classes.insert).not.toHaveBeenCalled();
  });

  it('rejects a start time in the past before persisting', async () => {
    const { useCase, classes } = setup();
    await expect(
      useCase.execute(command({ startsAt: new Date(NOW.getTime() - HOUR).toISOString() })),
    ).rejects.toThrow();
    expect(classes.insert).not.toHaveBeenCalled();
  });

  it('refuses an unverified teacher (AC-002)', async () => {
    const { useCase, classes } = setup(new FakeAccountTrustReader({ verified: false }));
    await expect(useCase.execute(command())).rejects.toThrow(UnverifiedTeacherError);
    expect(classes.insert).not.toHaveBeenCalled();
  });

  it('refuses a class skill the teacher is not approved for (SR-BR-002)', async () => {
    const { useCase, classes } = setup(
      new FakeAccountTrustReader({ approvedLevels: { 'skill-1': null } }),
    );
    await expect(useCase.execute(command())).rejects.toThrow(SkillNotApprovedError);
    expect(classes.insert).not.toHaveBeenCalled();
  });
});
