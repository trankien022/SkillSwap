import { PermanentHandlerError } from '../errors';

export interface BusMessage {
  id: string;
  eventType: string;
  occurredAt: string;
  payload: unknown;
}

export type EventHandler = (message: BusMessage) => Promise<void>;

export interface EventHandlerRegistration {
  moduleName: string;
  eventType: string;
  queue: string;
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
  return { id, eventType, occurredAt, payload };
}

/** Module-scoped consumers registry: queue name → handler (ADR-010 consumers). */
export class EventHandlerRegistry {
  private readonly byQueue = new Map<string, EventHandlerRegistration>();

  register(registration: EventHandlerRegistration): void {
    if (this.byQueue.has(registration.queue)) {
      throw new Error(`Queue already registered: ${registration.queue}`);
    }
    this.byQueue.set(registration.queue, registration);
  }

  list(): EventHandlerRegistration[] {
    return [...this.byQueue.values()];
  }

  isEmpty(): boolean {
    return this.byQueue.size === 0;
  }
}
