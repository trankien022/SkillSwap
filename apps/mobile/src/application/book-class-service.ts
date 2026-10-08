import type { BookingGateway } from './port/booking-gateway';
import type { BookingView, ClassView } from '@/domain/booking/booking';

/**
 * Application service for the learner booking flow (FR-007).
 * Holds the use-case orchestration; the UI stays presentation-only.
 */
export class BookClassService {
  constructor(private readonly gateway: BookingGateway) {}

  loadClass(classId: string): Promise<ClassView> {
    return this.gateway.getClass(classId);
  }

  book(classId: string, idempotencyKey: string): Promise<{ booking: BookingView; created: boolean }> {
    return this.gateway.bookClass(classId, idempotencyKey);
  }
}
