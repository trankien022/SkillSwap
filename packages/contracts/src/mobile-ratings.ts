import { z } from 'zod';

export const createRatingSchema = z.object({ stars: z.number().int().min(1).max(5), comment: z.string().trim().min(1).max(1000) });
export type CreateRatingInput = z.infer<typeof createRatingSchema>;
export const ratingViewSchema = z.object({
  id: z.string().min(1), bookingId: z.string().min(1), classId: z.string().min(1),
  stars: z.number().int().min(1).max(5), comment: z.string().min(1), createdAt: z.string().datetime({ offset: true }),
});
export type RatingView = z.infer<typeof ratingViewSchema>;
