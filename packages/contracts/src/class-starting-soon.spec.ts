import { CLASS_STARTING_SOON_EVENT, classStartingSoonSchema } from './class-starting-soon';

const CLASS_ID = '7c1e0000-0000-4000-8000-0000000000aa';
const LEARNER = '7c1e0000-0000-4000-8000-0000000000bb';
const TEACHER = '7c1e0000-0000-4000-8000-0000000000cc';

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    classId: CLASS_ID,
    startsAt: '2026-10-12T10:00:00.000Z',
    participants: [
      { accountId: LEARNER, role: 'learner' },
      { accountId: TEACHER, role: 'teacher' },
    ],
    ...overrides,
  };
}

describe('class.starting.soon contract (FR-016 / W3)', () => {
  it('names the event in the class.* family', () => {
    // The consumer subscribes by routing key; a typo here is a silent no-op delivery.
    expect(CLASS_STARTING_SOON_EVENT).toBe('class.starting.soon');
  });

  it('round-trips through JSON, because the payload crosses the broker', () => {
    const parsed = classStartingSoonSchema.parse(valid());
    const again = classStartingSoonSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(again).toEqual(parsed);
    expect(again.participants.map((p) => p.role)).toEqual(['learner', 'teacher']);
  });

  it('keeps the start time the reminder was about', () => {
    // Rendered later, the notification must state the instant the reminder referred to.
    const parsed = classStartingSoonSchema.parse(valid({ startsAt: '2026-10-12T17:00:00.000+07:00' }));
    expect(parsed.startsAt).toBe('2026-10-12T17:00:00.000+07:00');
    expect(new Date(parsed.startsAt).toISOString()).toBe('2026-10-12T10:00:00.000Z');
  });

  it('refuses a reminder nobody receives', () => {
    // Losing the participants must fail at publish time (visible as a DEAD row), not deliver
    // nothing quietly.
    expect(() => classStartingSoonSchema.parse(valid({ participants: [] }))).toThrow();
  });

  it('requires uuid identifiers, because consumers write them into uuid columns', () => {
    expect(() => classStartingSoonSchema.parse(valid({ classId: 'class-1' }))).toThrow();
    expect(() =>
      classStartingSoonSchema.parse(valid({ participants: [{ accountId: 'me', role: 'learner' }] })),
    ).toThrow();
  });

  it('refuses an unknown role rather than guessing the copy', () => {
    expect(() =>
      classStartingSoonSchema.parse(valid({ participants: [{ accountId: LEARNER, role: 'admin' }] })),
    ).toThrow();
  });

  it('refuses a timestamp without an offset, which is ambiguous across zones', () => {
    expect(() => classStartingSoonSchema.parse(valid({ startsAt: '2026-10-12T10:00:00' }))).toThrow();
  });
});
