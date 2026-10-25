import { Body, Controller, HttpCode, HttpStatus, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { RoomAccessResponse } from '@skillswap/contracts';
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
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  BookClassResultDto,
  BookingRequestDto,
  CancelClassResultDto,
  ClassDto,
  ConfirmBookingResultDto,
  CreateClassDto,
  MarkTeacherNoShowResultDto,
  RoomAccessRequestDto,
  RoomAccessResponseDto,
  StartClassResultDto,
  UpdateClassDto,
} from './dto/classes.dto';

@Controller('classes')
@ApiTags('classes')
@ApiBearerAuth('bearer')
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
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create and publish a class (FR-005 / API-004)' })
  @ApiOkResponse({ type: ClassDto, description: 'The published class' })
  create(
    @Body() body: CreateClassDto,
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
  @ApiParam({ name: 'id', description: 'The class id' })
  @ApiOperation({ summary: 'Book a class (FR-007 / API-005)' })
  @ApiOkResponse({ type: BookClassResultDto, description: 'The pending booking that holds a seat' })
  book(
    @Param('id') classId: string,
    @Body() body: BookingRequestDto,
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
  @ApiParam({ name: 'bookingId', description: 'The booking id' })
  @ApiOperation({ summary: 'Confirm a pending booking and settle payment (FR-009 / API-006)' })
  @ApiOkResponse({ type: ConfirmBookingResultDto, description: 'Whether the booking was confirmed' })
  confirm(
    @Param('bookingId') bookingId: string,
    @Req() request: RequestWithIdentity,
  ): Promise<ConfirmBookingResult> {
    return this.confirmBooking.execute({ bookingId, learnerId: currentUserId(request) });
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: 'The class id' })
  @ApiOperation({ summary: 'Edit a class before its first confirmed booking (FR-007 / AC-017)' })
  @ApiOkResponse({ type: ClassDto, description: 'The updated class' })
  update(
    @Param('id') classId: string,
    @Body() body: UpdateClassDto,
    @Req() request: RequestWithIdentity,
  ): Promise<ClassResource> {
    return this.updateClass.execute({ classId, teacherId: currentUserId(request), ...body });
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'The class id' })
  @ApiOperation({ summary: 'Cancel a class and refund affected learners (FR-007 / AC-022)' })
  @ApiOkResponse({ type: CancelClassResultDto, description: 'Cancellation summary' })
  cancel(
    @Param('id') classId: string,
    @Req() request: RequestWithIdentity,
  ): Promise<CancelClassResult> {
    return this.cancelClass.execute({ classId, teacherId: currentUserId(request) });
  }

  @Post('bookings/:bookingId/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'bookingId', description: 'The booking id' })
  @ApiOperation({ summary: 'Mark a teacher no-show for a booking (FR-007 / AC-024)' })
  @ApiOkResponse({ type: MarkTeacherNoShowResultDto, description: 'Whether the booking was cancelled for no-show' })
  noShow(@Param('bookingId') bookingId: string): Promise<MarkTeacherNoShowResult> {
    // AC-024 / AC-035: join evidence comes from `class_presence`, so the caller supplies
    // nothing. A Learner pressing this can no longer assert an absence that did not happen.
    return this.markNoShow.execute({ bookingId });
  }

  @Post('bookings/:bookingId/room-access')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'bookingId', description: 'The booking id' })
  @ApiOperation({ summary: 'Request room access for a booking (FR-011 / API-008)' })
  @ApiOkResponse({ type: RoomAccessResponseDto, description: 'Room name, short-lived token and join URL' })
  roomAccessForBooking(
    @Param('bookingId') bookingId: string,
    @Body() body: RoomAccessRequestDto,
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
  @ApiParam({ name: 'id', description: 'The class id' })
  @ApiOperation({ summary: 'Start a class the teacher is holding (FR-020 / ADR-021)' })
  @ApiOkResponse({ type: StartClassResultDto, description: 'Whether the class moved to in-progress' })
  start(@Param('id') classId: string, @Req() request: RequestWithIdentity): Promise<StartClassResult> {
    return this.startClass.execute({ classId, teacherId: currentUserId(request) });
  }

  // ADR-021 Amendment A / AC-035: there is deliberately no teacher-initiated
  // "complete" route. A class ends when the scheduled time elapses (or, later,
  // when the room stays empty past the grace period); a Teacher cannot end it.
}
