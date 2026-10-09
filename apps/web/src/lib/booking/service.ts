import type { BookClassResult, BookingGateway, ClassView } from './domain';

/**
 * Application service for the learner booking flow (FR-007). Keeps the UI
 * presentation-only; the gateway is injected so mock and real are interchangeable.
 */
export class BookClassService {
  constructor(private readonly gateway: BookingGateway) {}

  loadClass(classId: string): Promise<ClassView> {
    return this.gateway.getClass(classId);
  }

  book(classId: string, idempotencyKey: string): Promise<BookClassResult> {
    return this.gateway.bookClass(classId, idempotencyKey);
  }
}
