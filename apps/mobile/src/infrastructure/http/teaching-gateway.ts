import { classSchema, createClassSchema, updateClassSchema, type ClassView, type CreateClassInput, type UpdateClassInput } from '@skillswap/contracts';
import type { GatewayClient } from './gateway-client';

/** Authenticated teacher commands. Lifecycle transitions stay server-authoritative. */
export class TeachingGateway {
  constructor(private readonly gateway: GatewayClient) {}

  async create(input: CreateClassInput): Promise<ClassView> {
    const body = createClassSchema.parse(input);
    return classSchema.parse(await this.gateway.authenticatedRequest<unknown>('/classes', { method: 'POST', body }));
  }
  async update(classId: string, input: UpdateClassInput): Promise<ClassView> {
    const body = updateClassSchema.parse(input);
    return classSchema.parse(await this.gateway.authenticatedRequest<unknown>(`/classes/${encodeURIComponent(classId)}`, { method: 'PATCH', body }));
  }
  async cancel(classId: string): Promise<void> {
    await this.gateway.authenticatedRequest<unknown>(`/classes/${encodeURIComponent(classId)}/cancel`, { method: 'POST' });
  }
  async start(classId: string): Promise<void> {
    await this.gateway.authenticatedRequest<unknown>(`/classes/${encodeURIComponent(classId)}/start`, { method: 'POST' });
  }
  async complete(classId: string): Promise<void> {
    await this.gateway.authenticatedRequest<unknown>(`/classes/${encodeURIComponent(classId)}/complete`, { method: 'POST' });
  }
  /**
   * Declares that the **teacher** never joined this booking's class, which
   * cancels the booking and refunds the learner (FR-007 / AC-024).
   *
   * This is learner protection, not a teacher marking a learner absent: the
   * server only cancels once the first 15 minutes of the class have elapsed with
   * no teacher join (`isTeacherNoShow`). Before that window closes it answers
   * `{ cancelled: false }` — a refusal, not a failure — so the result is returned
   * to the caller rather than discarded.
   *
   * The endpoint takes the booking id because the claim is about one booking,
   * not the class as a whole.
   */
  async reportTeacherNoShow(bookingId: string): Promise<{ cancelled: boolean }> {
    return this.gateway.authenticatedRequest<{ cancelled: boolean }>(
      `/classes/bookings/${encodeURIComponent(bookingId)}/no-show`,
      { method: 'POST' },
    );
  }
}
