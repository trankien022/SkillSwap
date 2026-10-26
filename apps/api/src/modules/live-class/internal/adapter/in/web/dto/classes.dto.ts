import { createZodDto } from 'nestjs-zod';
import {
  bookClassResultSchema,
  bookingRequestSchema,
  bookingSchema,
  cancelClassResultSchema,
  classSchema,
  confirmBookingResultSchema,
  createClassSchema,
  markTeacherNoShowResultSchema,
  roomAccessRequestSchema,
  roomAccessResponseSchema,
  startClassResultSchema,
  updateClassSchema,
} from '@skillswap/contracts';

/** FR-005 / API-004: create and publish a class. Body for POST /classes. */
export class CreateClassDto extends createZodDto(createClassSchema) {}

/** FR-007 / AC-017: edit a class. Body for PATCH /classes/:id. */
export class UpdateClassDto extends createZodDto(updateClassSchema) {}

/** FR-007 / API-005: book a class. Body for POST /classes/:id/bookings. */
export class BookingRequestDto extends createZodDto(bookingRequestSchema) {}

/** FR-005: the published class projection. */
export class ClassDto extends createZodDto(classSchema) {}

/** FR-007: the booking projection returned by the booking endpoints. */
export class BookingDto extends createZodDto(bookingSchema) {}

/** FR-007 / API-005: result of booking a class. */
export class BookClassResultDto extends createZodDto(bookClassResultSchema) {}

/** FR-009 / API-006: result of confirming a pending booking. */
export class ConfirmBookingResultDto extends createZodDto(confirmBookingResultSchema) {}

/** FR-007 / AC-022: result of cancelling a class. */
export class CancelClassResultDto extends createZodDto(cancelClassResultSchema) {}

/** FR-007 / AC-024: result of marking a teacher no-show. */
export class MarkTeacherNoShowResultDto extends createZodDto(markTeacherNoShowResultSchema) {}

/** FR-020 / ADR-021: result of starting a class. */
export class StartClassResultDto extends createZodDto(startClassResultSchema) {}

/** FR-011: join an online class room. Body for POST /classes/bookings/:bookingId/room-access. */
export class RoomAccessRequestDto extends createZodDto(roomAccessRequestSchema) {}

/** FR-011: the room name, short-lived token and join URL. */
export class RoomAccessResponseDto extends createZodDto(roomAccessResponseSchema) {}
