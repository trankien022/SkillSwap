import {
  UNSEQUENCED,
  aggregateIdOf,
  isNewerThan,
  remember,
  sequenceOf,
} from './event-sequence';

/**
 * ADR-013 Amendment A (W2 C1): ordering guards are consumer-side and must stay harmless for
 * events that predate the sequence field, because those rows are still in the outbox.
 */
describe('aggregateIdOf', () => {
  it('keys on the entity the consumer reads, preferring the booking', () => {
    expect(aggregateIdOf({ bookingId: 'b1', classId: 'c1', accountId: 'a1' })).toBe('b1');
    expect(aggregateIdOf({ classId: 'c1', accountId: 'a1' })).toBe('c1');
    expect(aggregateIdOf({ accountId: 'a1' })).toBe('a1');
    expect(aggregateIdOf({ transactionId: 't1' })).toBe('t1');
  });

  it('returns null rather than inventing an aggregate', () => {
    expect(aggregateIdOf({})).toBeNull();
    expect(aggregateIdOf({ bookingId: '' })).toBeNull();
    expect(aggregateIdOf({ bookingId: 42 })).toBeNull();
    expect(aggregateIdOf(null)).toBeNull();
    expect(aggregateIdOf('booking:1')).toBeNull();
  });
});

describe('sequenceOf', () => {
  it('reads a stamped sequence', () => {
    expect(sequenceOf({ sequence: 0 })).toBe(0);
    expect(sequenceOf({ sequence: 7 })).toBe(7);
  });

  it('treats a missing or unusable sequence as older than anything known', () => {
    // E8: historical rows must stay deliverable, so absence is "old", not "invalid".
    expect(sequenceOf({})).toBe(UNSEQUENCED);
    expect(sequenceOf({ sequence: null })).toBe(UNSEQUENCED);
    expect(sequenceOf({ sequence: -1 })).toBe(UNSEQUENCED);
    expect(sequenceOf({ sequence: 1.5 })).toBe(UNSEQUENCED);
    expect(sequenceOf({ sequence: '3' })).toBe(UNSEQUENCED);
    expect(sequenceOf({ sequence: Number.NaN })).toBe(UNSEQUENCED);
  });
});

describe('isNewerThan', () => {
  it('applies the first event an aggregate ever has', () => {
    expect(isNewerThan(undefined, UNSEQUENCED)).toBe(true);
    expect(isNewerThan(undefined, 0)).toBe(true);
  });

  it('ignores a late arrival that a newer sequence already overtook', () => {
    expect(isNewerThan(5, 4)).toBe(false);
  });

  it('applies the same or a newer sequence', () => {
    expect(isNewerThan(5, 5)).toBe(true);
    expect(isNewerThan(5, 6)).toBe(true);
  });

  it('still applies an unstamped event to an aggregate that saw only unstamped ones', () => {
    expect(isNewerThan(UNSEQUENCED, UNSEQUENCED)).toBe(true);
    // Once anything was stamped, an unstamped row is older than it.
    expect(isNewerThan(0, UNSEQUENCED)).toBe(false);
  });

  it('converges on the newest sequence regardless of delivery order', () => {
    const deliveries = [3, 1, 5, 2, 4];
    let applied = -1;
    let seen: number | undefined;
    for (const sequence of deliveries) {
      if (isNewerThan(seen, sequence)) {
        applied = sequence;
        seen = sequence;
      }
    }
    expect(applied).toBe(5);
  });
});

describe('remember', () => {
  it('keeps the newest sequence per aggregate', () => {
    const watermarks = new Map<string, number>();
    remember(watermarks, 'b1', 2);
    remember(watermarks, 'b2', 9);
    remember(watermarks, 'b1', 3);
    expect(watermarks.get('b1')).toBe(3);
    expect(watermarks.get('b2')).toBe(9);
  });

  it('never grows without bound, so traffic cannot exhaust memory', () => {
    const watermarks = new Map<string, number>();
    for (let index = 0; index < 20_000; index += 1) {
      remember(watermarks, `b${index}`, index);
      expect(watermarks.size).toBeLessThanOrEqual(5_000);
    }
    // The newest aggregate is always retained; the oldest are evicted first.
    expect(watermarks.has('b19999')).toBe(true);
    expect(watermarks.has('b0')).toBe(false);
  });
});
