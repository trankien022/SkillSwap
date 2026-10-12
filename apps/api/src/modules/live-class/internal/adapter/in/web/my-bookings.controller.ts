import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  decodeBookingCursor,
  encodeBookingCursor,
  myBookingsPageSchema,
  myBookingsQuerySchema,
  type MyBookingsQueryInput,
  type MyBookingsPageView,
} from '@skillswap/contracts';
import {
  LIST_MY_BOOKINGS,
  type BookingCursorTuple,
  type ListMyBookingsPort,
} from '../../../application/port/in/list-my-bookings';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

/**
 * Route 22 / FR-007, FR-009, FR-011, FR-020: Learner bookings and exact upcoming count.
 * Requires authentication; strictly scoped to currentUserId with no callerId/learnerId override.
 */
@Controller('classes')
@ApiTags('classes')
export class MyBookingsController {
  constructor(
    @Inject(LIST_MY_BOOKINGS) private readonly listMyBookings: ListMyBookingsPort,
  ) {}

  @Get('bookings/me')
  @ApiOperation({
    summary: 'Get learner bookings and exact upcoming count (FR-007, FR-009, FR-011, FR-020 / Route 22)',
  })
  @ApiOkResponse({
    description: 'Paginated learner bookings with nextCursor and exact totalUpcomingCount',
  })
  async listMe(
    @Query(new ZodValidationPipe<unknown>(myBookingsQuerySchema)) query: MyBookingsQueryInput,
    @Req() request: RequestWithIdentity,
  ): Promise<MyBookingsPageView> {
    const userId = currentUserId(request);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException('Authentication required');
    }

    let cursorTuple: BookingCursorTuple | undefined;
    if (query.cursor) {
      try {
        cursorTuple = decodeBookingCursor(query.cursor);
      } catch {
        throw new BadRequestException('Malformed booking cursor');
      }
    }

    const page = await this.listMyBookings.execute({
      learnerId: userId,
      state: query.state,
      upcoming: query.upcoming,
      limit: query.limit,
      cursor: cursorTuple,
    });

    return myBookingsPageSchema.parse({
      items: page.items,
      nextCursor: page.nextCursor ? encodeBookingCursor(page.nextCursor) : null,
      totalUpcomingCount: page.totalUpcomingCount,
    });
  }
}
