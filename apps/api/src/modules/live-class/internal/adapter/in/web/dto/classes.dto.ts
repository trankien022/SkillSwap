import { createZodDto } from 'nestjs-zod';
import {
  bookingRequestSchema,
  classSchema,
  createClassSchema,
  roomAccessRequestSchema,
  roomAccessResponseSchema,
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

/** FR-011: join an online class room. Body for POST /classes/bookings/:bookingId/room-access. */
export class RoomAccessRequestDto extends createZodDto(roomAccessRequestSchema) {}

/** FR-011: the room name, short-lived token and join URL. */
export class RoomAccessResponseDto extends createZodDto(roomAccessResponseSchema) {}
