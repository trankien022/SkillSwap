import { BadRequestException, Body, ConflictException, Controller, Inject, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createRatingSchema, ratingViewSchema, type CreateRatingInput, type RatingView } from '@skillswap/contracts';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';
import { RatingAlreadyExistsError, RatingNotEligibleError, SUBMIT_RATING, type SubmitRatingPort } from '../../../application/port/in/submit-rating';

@Controller('classes/bookings')
@ApiTags('classes')
export class RatingsController {
  constructor(@Inject(SUBMIT_RATING) private readonly submitRating: SubmitRatingPort) {}

  @Post(':bookingId/rating')
  @ApiOperation({ summary: 'Submit one rating for an eligible completed class (FR-013 / Route 27)' })
  @ApiCreatedResponse({ description: 'Persisted learner rating' })
  async create(
    @Param('bookingId') bookingId: string,
    @Body(new ZodValidationPipe(createRatingSchema)) body: CreateRatingInput,
    @Req() request: RequestWithIdentity,
  ): Promise<RatingView> {
    const learnerId = currentUserId(request);
    if (!learnerId || learnerId === 'anonymous') throw new UnauthorizedException('Authentication required');
    try {
      return ratingViewSchema.parse(await this.submitRating.execute({ bookingId, learnerId, ...body }));
    } catch (error) {
      if (error instanceof RatingAlreadyExistsError) throw new ConflictException(error.message);
      if (error instanceof RatingNotEligibleError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
