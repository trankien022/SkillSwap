import { CreateClassUseCase } from './create-class.use-case';
import type { ClassRepository, CreateClassRecord, PersistedClass } from './port/out/class-repository';
import type { Clock } from './port/out/clock';
import { InvalidCapacityError } from '../domain/class';

const NOW = new Date('2026-10-08T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function setup() {
  const calls: CreateClassRecord[] = [];
  const classes: ClassRepository = {
    insert: jest.fn(async (record: CreateClassRecord) => {
      calls.push(record);
      return { id: 'cls-new', ...record } as PersistedClass;
    }),
    findById: jest.fn(async () => null),
  };
  const clock: Clock = { now: () => NOW };
  return { useCase: new CreateClassUseCase(classes, clock), classes, calls };
}

function command(overrides: Partial<Parameters<CreateClassUseCase['execute']>[0]> = {}) {
  return {
    teacherId: 'teacher-1',
    skillIds: ['skill-1'],
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
      startsAt: new Date(NOW.getTime() + 48 * HOUR).toISOString(),
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 1,
    });
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
});
