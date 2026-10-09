import { Body, Controller, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  bookingRequestSchema,
  createClassSchema,
  type BookingRequestInput,
  type CreateClassInput,
} from '@skillswap/contracts';
import {
  CREATE_CLASS,
  type ClassResource,
  type CreateClassPort,
} from '../../../application/port/in/create-class';
import {
  BOOK_CLASS,
  type BookClassPort,
  type BookClassResult,
} from '../../../application/port/in/book-class';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

@Controller('classes')
@ApiTags('classes')
export class ClassesController {
  constructor(
    @Inject(CREATE_CLASS) private readonly createClass: CreateClassPort,
    @Inject(BOOK_CLASS) private readonly bookClass: BookClassPort,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create and publish a class (FR-005 / API-004)' })
  @ApiOkResponse({ description: 'The published class' })
  create(
    @Body(new ZodValidationPipe(createClassSchema)) body: CreateClassInput,
    @Req() request: RequestWithIdentity,
  ): Promise<ClassResource> {
    return this.createClass.execute({
      teacherId: currentUserId(request),
      skillIds: body.skillIds,
      description: body.description,
      startsAt: body.startsAt,
      durationMinutes: body.durationMinutes,
      priceCredits: body.priceCredits,
      capacity: body.capacity,
    });
  }

  @Post(':id/bookings')
  @ApiOperation({ summary: 'Book a class (FR-007 / API-005)' })
  @ApiOkResponse({ description: 'The pending booking that holds a seat' })
  book(
    @Param('id') classId: string,
    @Body(new ZodValidationPipe(bookingRequestSchema)) body: BookingRequestInput,
    @Req() request: RequestWithIdentity,
  ): Promise<BookClassResult> {
    return this.bookClass.execute({
      classId,
      learnerId: currentUserId(request),
      idempotencyKey: body.idempotencyKey,
    });
  }
}
