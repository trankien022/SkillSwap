import { PermanentHandlerError } from '../errors';
import {
  EventHandlerRegistry,
  parseEnvelope,
  type EventHandlerRegistration,
} from './event-handler-registry';

function registration(overrides: Partial<EventHandlerRegistration> = {}): EventHandlerRegistration {
  return {
    moduleName: 'schedule',
    eventTypes: ['booking.confirmed'],
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

describe('EventHandlerRegistry (ADR-013 Amendment B)', () => {
  it('registers handlers under one queue per module', () => {
    const registry = new EventHandlerRegistry();
    expect(registry.isEmpty()).toBe(true);

    registry.register(registration({ moduleName: 'wallet-ledger', eventTypes: ['booking.confirmed'] }));
    registry.register(registration({ moduleName: 'wallet-ledger', eventTypes: ['booking.cancelled'] }));

    expect(registry.isEmpty()).toBe(false);
    expect(registry.queues()).toEqual([
      {
        moduleName: 'wallet-ledger',
        queue: 'wallet-ledger',
        eventTypes: ['booking.confirmed', 'booking.cancelled'],
      },
    ]);
  });

  it('binds every routing key of a module to that module queue', () => {
    const registry = new EventHandlerRegistry();
    registry.register(registration({ moduleName: 'live-class', eventTypes: ['a.b', 'c.d'] }));

    expect(registry.queues()[0]!.eventTypes).toEqual(['a.b', 'c.d']);
  });

  it('keeps two handlers for the same event type, in registration order', async () => {
    const registry = new EventHandlerRegistry();
    const calls: string[] = [];
    const projection = async (): Promise<void> => {
      calls.push('projection');
    };
    const notification = async (): Promise<void> => {
      calls.push('notification');
    };

    // account-profile's real shape: one event, two independent effects.
    registry.register(registration({ moduleName: 'account-profile', eventTypes: ['v.approved'], handler: projection }));
    registry.register(registration({ moduleName: 'account-profile', eventTypes: ['v.approved'], handler: notification }));

    const handlers = registry.handlersFor('account-profile', 'v.approved');
    expect(handlers).toEqual([projection, notification]);
    await Promise.all(handlers.map((handler) => handler({ id: 'e', eventType: 'v.approved', occurredAt: '', payload: {} })));
    expect(calls).toEqual(['projection', 'notification']);
  });

  it('registers one handler against several event types', () => {
    const registry = new EventHandlerRegistry();
    const handler = async (): Promise<void> => undefined;
    registry.register(registration({ moduleName: 'admin-operation', eventTypes: ['x.y', 'x.z'], handler }));

    expect(registry.handlersFor('admin-operation', 'x.y')).toEqual([handler]);
    expect(registry.handlersFor('admin-operation', 'x.z')).toEqual([handler]);
  });

  it('rejects the same handler registered twice for one event type', () => {
    const registry = new EventHandlerRegistry();
    const handler = async (): Promise<void> => undefined;
    registry.register(registration({ moduleName: 'schedule', eventTypes: ['a.b'], handler }));

    expect(() =>
      registry.register(registration({ moduleName: 'schedule', eventTypes: ['a.b'], handler })),
    ).toThrow(/already registered/);
  });

  it('rejects a registration that subscribes to nothing', () => {
    const registry = new EventHandlerRegistry();
    expect(() => registry.register(registration({ eventTypes: [] }))).toThrow(/at least one/);
  });

  it('returns no handlers for an event type the queue never bound', () => {
    const registry = new EventHandlerRegistry();
    registry.register(registration({ moduleName: 'schedule', eventTypes: ['a.b'] }));

    expect(registry.handlersFor('schedule', 'other.event')).toEqual([]);
    expect(registry.handlersFor('unknown-module', 'a.b')).toEqual([]);
  });
});
