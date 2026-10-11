import { createRatingSchema, ratingViewSchema, type CreateRatingInput, type RatingView } from '@skillswap/contracts';
import type { GatewayClient } from './gateway-client';

export class RatingGateway {
  constructor(private readonly gateway: GatewayClient) {}
  async submit(bookingId: string, input: CreateRatingInput): Promise<RatingView> {
    const body = createRatingSchema.parse(input);
    const raw = await this.gateway.authenticatedRequest<unknown>(`/classes/bookings/${encodeURIComponent(bookingId)}/rating`, { method: 'POST', body });
    return ratingViewSchema.parse(raw);
  }
}
