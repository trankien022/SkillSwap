import { BadRequestException, Body, ConflictException, Controller, Inject, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { createRatingSchema, ratingViewSchema, type CreateRatingInput, type RatingView } from '@skillswap/contracts';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';
import { RatingAlreadyExistsError, RatingNotEligibleError, SUBMIT_RATING, type SubmitRatingPort } from '../../../application/port/in/submit-rating';
import { RatingViewDto } from './dto/ratings.dto';
@Controller('classes/bookings')
@ApiTags('classes')
@ApiBearerAuth('bearer')
export class RatingsController {
  constructor(@Inject(SUBMIT_RATING) private readonly submitRating: SubmitRatingPort) {}

  @Post(':bookingId/rating')
  @ResponseCode('RATING_SUBMIT_OK')
  @ResponseMessage('Rating submitted')
  @ApiParam({ name: 'bookingId', description: 'The booking being rated' })
  @ApiOperation({
    summary: 'Submit one rating for an eligible completed class (FR-013 / Route 27)',
    description:
      'The caller must own a confirmed booking whose class has actually completed, and may rate that booking once.',
  })
  @ApiCreatedResponse({ type: RatingViewDto, description: 'Persisted learner rating' })
  @ApiConflictResponse({ description: 'That booking already has a rating (HTTP_409)' })
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
