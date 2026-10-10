import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  bookingRequestSchema,
  createClassSchema,
  roomAccessRequestSchema,
  updateClassSchema,
  type BookingRequestInput,
  type CreateClassInput,
  type RoomAccessRequestInput,
  type RoomAccessResponse,
  type UpdateClassInput,
} from '@skillswap/contracts';
import {
  CREATE_CLASS,
  type ClassResource,
  type CreateClassPort,
} from '../../../application/port/in/create-class';
import {
  UPDATE_CLASS,
  type UpdateClassPort,
} from '../../../application/port/in/update-class';
import {
  BOOK_CLASS,
  type BookClassPort,
  type BookClassResult,
} from '../../../application/port/in/book-class';
import {
  CONFIRM_BOOKING,
  type ConfirmBookingPort,
  type ConfirmBookingResult,
} from '../../../application/port/in/confirm-booking';
import {
  CANCEL_CLASS,
  type CancelClassPort,
  type CancelClassResult,
} from '../../../application/port/in/cancel-class';
import {
  MARK_TEACHER_NO_SHOW,
  type MarkTeacherNoShowPort,
  type MarkTeacherNoShowResult,
} from '../../../application/port/in/mark-teacher-no-show';
import {
  REQUEST_ROOM_ACCESS,
  type RequestRoomAccessPort,
} from '../../../application/port/in/request-room-access';
import {
  START_CLASS,
  type StartClassPort,
  type StartClassResult,
} from '../../../application/port/in/start-class';
import {
  COMPLETE_CLASS,
  type CompleteClassPort,
  type CompleteClassResult,
} from '../../../application/port/in/complete-class';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

@Controller('classes')
@ApiTags('classes')
export class ClassesController {
  constructor(
    @Inject(CREATE_CLASS) private readonly createClass: CreateClassPort,
    @Inject(UPDATE_CLASS) private readonly updateClass: UpdateClassPort,
    @Inject(BOOK_CLASS) private readonly bookClass: BookClassPort,
    @Inject(CONFIRM_BOOKING) private readonly confirmBooking: ConfirmBookingPort,
    @Inject(CANCEL_CLASS) private readonly cancelClass: CancelClassPort,
    @Inject(MARK_TEACHER_NO_SHOW) private readonly markNoShow: MarkTeacherNoShowPort,
    @Inject(REQUEST_ROOM_ACCESS) private readonly roomAccess: RequestRoomAccessPort,
    @Inject(START_CLASS) private readonly startClass: StartClassPort,
    @Inject(COMPLETE_CLASS) private readonly completeClass: CompleteClassPort,
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

  @Post('bookings/:bookingId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a pending booking and settle payment (FR-009 / API-006)' })
  @ApiOkResponse({ description: 'Whether the booking was confirmed' })
  confirm(
    @Param('bookingId') bookingId: string,
    @Req() request: RequestWithIdentity,
  ): Promise<ConfirmBookingResult> {
    return this.confirmBooking.execute({ bookingId, learnerId: currentUserId(request) });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a class before its first confirmed booking (FR-007 / AC-017)' })
  @ApiOkResponse({ description: 'The updated class' })
  update(
    @Param('id') classId: string,
    @Body(new ZodValidationPipe(updateClassSchema)) body: UpdateClassInput,
    @Req() request: RequestWithIdentity,
  ): Promise<ClassResource> {
    return this.updateClass.execute({ classId, teacherId: currentUserId(request), ...body });
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a class and refund affected learners (FR-007 / AC-022)' })
  @ApiOkResponse({ description: 'Cancellation summary' })
  cancel(
    @Param('id') classId: string,
    @Req() request: RequestWithIdentity,
  ): Promise<CancelClassResult> {
    return this.cancelClass.execute({ classId, teacherId: currentUserId(request) });
  }

  @Post('bookings/:bookingId/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a teacher no-show for a booking (FR-007 / AC-024)' })
  @ApiOkResponse({ description: 'Whether the booking was cancelled for no-show' })
  noShow(@Param('bookingId') bookingId: string): Promise<MarkTeacherNoShowResult> {
    // Join evidence comes from FR-011 room access; until then a null join is assumed.
    return this.markNoShow.execute({ bookingId, teacherJoinedAt: null });
  }

  @Post('bookings/:bookingId/room-access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request room access for a booking (FR-011 / API-008)' })
  @ApiOkResponse({ description: 'Room name, short-lived token and join URL' })
  roomAccessForBooking(
    @Param('bookingId') bookingId: string,
    @Body(new ZodValidationPipe(roomAccessRequestSchema)) body: RoomAccessRequestInput,
    @Req() request: RequestWithIdentity,
  ): Promise<RoomAccessResponse> {
    return this.roomAccess.execute({
      bookingId,
      requesterId: currentUserId(request),
      displayName: body.displayName,
    });
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a class the teacher is holding (FR-020 / ADR-021)' })
  @ApiOkResponse({ description: 'Whether the class moved to in-progress' })
  start(@Param('id') classId: string, @Req() request: RequestWithIdentity): Promise<StartClassResult> {
    return this.startClass.execute({ classId, teacherId: currentUserId(request) });
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End a class the teacher held (FR-020 / ADR-021)' })
  @ApiOkResponse({ description: 'Whether the class completed and on what basis' })
  complete(
    @Param('id') classId: string,
    @Req() request: RequestWithIdentity,
  ): Promise<CompleteClassResult> {
    return this.completeClass.execute({ classId, teacherId: currentUserId(request) });
  }
}
