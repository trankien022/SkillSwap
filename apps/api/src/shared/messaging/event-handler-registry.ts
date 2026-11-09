import { PermanentHandlerError } from '../errors';

export interface BusMessage {
  id: string;
  eventType: string;
  occurredAt: string;
  /**
   * ADR-013 Amendment A (W2 C1): position of this event within its aggregate. Absent on
   * events published before the field existed, which consumers must treat as "old".
   */
  sequence?: number;
  payload: unknown;
}

export type EventHandler = (message: BusMessage) => Promise<void>;

export interface EventHandlerRegistration {
  moduleName: string;
  /**
   * Every routing key this consumer wants. A registration may claim several event types
   * because a queue is a consumer endpoint, not a message type: the module is the unit that
   * scales together, so it is the unit that gets a queue (ADR-013 Amendment B).
   */
  eventTypes: readonly string[];
  handler: EventHandler;
}

export function parseEnvelope(raw: unknown): BusMessage {
  if (typeof raw !== 'object' || raw === null) {
    throw new PermanentHandlerError('Event envelope must be an object');
  }
  const record = raw as Record<string, unknown>;
  const { id, eventType, occurredAt, payload } = record;
  if (typeof id !== 'string' || id === '') {
    throw new PermanentHandlerError('Event envelope is missing id');
  }
  if (typeof eventType !== 'string' || eventType === '') {
    throw new PermanentHandlerError('Event envelope is missing eventType');
  }
  if (typeof occurredAt !== 'string' || Number.isNaN(Date.parse(occurredAt))) {
    throw new PermanentHandlerError('Event envelope has invalid occurredAt');
  }
  if (payload === undefined) {
    throw new PermanentHandlerError('Event envelope is missing payload');
  }
  // ADR-013 Amendment A (W2 C1): a missing sequence is legal and means "unstamped". A present
  // but unusable one is a producer defect, and `sequenceOf` reads it as unstamped so the event
  // is still applied rather than dead-lettered over a field it does not need.
  const sequence =
    typeof record.sequence === 'number' && Number.isSafeInteger(record.sequence)
      ? record.sequence
      : undefined;
  return { id, eventType, occurredAt, sequence, payload };
}

/** One module's subscriptions: every routing key it wants, and the handlers for each. */
export interface ConsumerQueue {
  moduleName: string;
  /** The AMQP queue name. Equal to `moduleName`, so it also keys `processed_events`. */
  queue: string;
  /** Routing keys to bind. Deduplicated across every registration for this module. */
  eventTypes: string[];
}

/**
 * Module-scoped consumers registry (ADR-010 consumers, ADR-013 Amendment B).
 *
 * A queue is keyed by **module**, not by event type. Every handler in this process shares one
 * connection and one prefetch, so a queue per event type bought 39 failure domains and no
 * isolation; a queue per module keeps the boundary that is real (the schema boundary) and
 * drops the rest. Declaring 117 durable queues also exceeded CloudAMQP's 100-queue free limit.
 *
 * **A routing key may map to several handlers, and that is required.** `account-profile` both
 * projects a verification's status and writes an inbox row from the same event, so it registers
 * two handlers for one event type. Collapsing them into one would silently drop a notification;
 * `register` therefore appends.
 */
export class EventHandlerRegistry {
  private readonly byQueue = new Map<string, ModuleSubscriptions>();

  register(registration: EventHandlerRegistration): void {
    if (registration.eventTypes.length === 0) {
      throw new Error('A consumer registration must subscribe to at least one event type');
    }
    let module = this.byQueue.get(registration.moduleName);
    if (module === undefined) {
      module = { moduleName: registration.moduleName, handlers: new Map() };
      this.byQueue.set(registration.moduleName, module);
    }
    for (const eventType of registration.eventTypes) {
      const handlers = module.handlers.get(eventType) ?? [];
      // A duplicated handler is a copy-paste defect, not a subscription: it would run the same
      // effect twice per delivery. Two *different* handlers on one event are legitimate.
      if (handlers.includes(registration.handler)) {
        throw new Error(
          `Handler already registered for ${registration.moduleName}:${eventType}`,
        );
      }
      handlers.push(registration.handler);
      module.handlers.set(eventType, handlers);
    }
  }

  /** The queues to declare, one per module, with the routing keys each must bind. */
  queues(): ConsumerQueue[] {
    return [...this.byQueue.values()].map((module) => ({
      moduleName: module.moduleName,
      queue: module.moduleName,
      eventTypes: [...module.handlers.keys()],
    }));
  }

  /**
   * The handlers for a delivered event type on a queue, in registration order.
   *
   * Empty means "this queue is not subscribed to that event", which can only happen when a
   * routing key is bound elsewhere or the topology changed under a live connection. The caller
   * treats it as a permanent failure rather than acking silently, because the alternative is a
   * message that looks handled and was not.
   */
  handlersFor(queue: string, eventType: string): EventHandler[] {
    return this.byQueue.get(queue)?.handlers.get(eventType) ?? [];
  }

  isEmpty(): boolean {
    return this.byQueue.size === 0;
  }
}

interface ModuleSubscriptions {
  moduleName: string;
  /** routing key → handlers, in registration order. */
  handlers: Map<string, EventHandler[]>;
}
