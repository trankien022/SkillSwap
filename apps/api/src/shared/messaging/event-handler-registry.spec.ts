import { PermanentHandlerError } from '../errors';
import {
  EventHandlerRegistry,
  parseEnvelope,
  type EventHandlerRegistration,
} from './event-handler-registry';

function registration(overrides: Partial<EventHandlerRegistration> = {}): EventHandlerRegistration {
  return {
    moduleName: 'schedule',
    eventType: 'booking.confirmed',
    queue: 'wallet-ledger.booking-confirmed',
    handler: async () => undefined,
    ...overrides,
  };
}

describe('parseEnvelope', () => {
  const valid = {
    id: '6f0d1b5e-0000-4000-8000-000000000001',
    eventType: 'booking.confirmed',
    occurredAt: new Date().toISOString(),
    payload: { bookingId: 'b-1' },
  };

  it('accepts a well-formed envelope', () => {
    expect(parseEnvelope(valid)).toEqual(valid);
  });

  it.each([
    ['non-object', 'nope'],
    ['missing id', { ...valid, id: '' }],
    ['missing eventType', { ...valid, eventType: undefined }],
    ['invalid occurredAt', { ...valid, occurredAt: 'yesterday' }],
    ['missing payload', { ...valid, payload: undefined }],
    ['null', null],
  ])('rejects %s', (_label, input) => {
    expect(() => parseEnvelope(input)).toThrow(PermanentHandlerError);
  });
});

describe('EventHandlerRegistry', () => {
  it('registers handlers per queue', () => {
    const registry = new EventHandlerRegistry();
    expect(registry.isEmpty()).toBe(true);
    registry.register(registration());
    registry.register(registration({ queue: 'schedule.booking-confirmed', eventType: 'booking.confirmed' }));
    expect(registry.isEmpty()).toBe(false);
    expect(registry.list()).toHaveLength(2);
  });

  it('rejects duplicate queue names', () => {
    const registry = new EventHandlerRegistry();
    registry.register(registration());
    expect(() => registry.register(registration())).toThrow(/already registered/);
  });
});
