import { classRosterSchema } from './class-roster';

const base = {
  classId: '5eedc1a5-0000-4000-8000-000000000007',
  capacity: 6,
  entries: [
    {
      bookingId: '5eedb00c-0000-4000-8000-000000000021',
      learnerId: '5eed5e7d-0000-4000-8000-000000000010',
      displayName: 'Demo User 10',
      state: 'confirmed' as const,
      createdAt: '2026-11-01T09:00:00.000Z',
    },
  ],
};

describe('classRosterSchema (FR-011 / ADR-040)', () => {
  it('accepts a populated roster', () => {
    expect(classRosterSchema.parse(base)).toEqual(base);
  });

  it('accepts an empty roster with a positive capacity', () => {
    const empty = { classId: base.classId, capacity: 1, entries: [] };
    expect(classRosterSchema.parse(empty)).toEqual(empty);
  });

  it('rejects a seat with no display name, so an id cannot stand in for a person', () => {
    const bad = { ...base, entries: [{ ...base.entries[0], displayName: '' }] };
    expect(() => classRosterSchema.parse(bad)).toThrow();
  });

  it('rejects an unknown seat state', () => {
    const bad = { ...base, entries: [{ ...base.entries[0], state: 'cancelled' }] };
    expect(() => classRosterSchema.parse(bad)).toThrow();
  });

  it('rejects a non-positive capacity', () => {
    expect(() => classRosterSchema.parse({ ...base, capacity: 0 })).toThrow();
  });

  it('requires an offset-bearing timestamp for createdAt', () => {
    const bad = { ...base, entries: [{ ...base.entries[0], createdAt: '2026-11-01T09:00:00' }] };
    expect(() => classRosterSchema.parse(bad)).toThrow();
  });
});
