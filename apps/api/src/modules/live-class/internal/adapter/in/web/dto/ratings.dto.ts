import { createZodDto } from 'nestjs-zod';
import { ratingViewSchema } from '@skillswap/contracts';

/** FR-013: the persisted learner rating returned by POST /classes/bookings/:bookingId/rating. */
export class RatingViewDto extends createZodDto(ratingViewSchema) {}
