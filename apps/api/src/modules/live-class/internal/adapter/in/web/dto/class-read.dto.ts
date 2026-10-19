import { createZodDto } from 'nestjs-zod';
import {
  classDetailViewSchema,
  listClassesPageSchema,
  myBookingsPageSchema,
} from '@skillswap/contracts';

/**
 * FR-005, FR-006 / Route 13: the marketplace and own-teaching class list.
 * Declared as a response DTO so the generated reference names the payload type
 * instead of describing it only in prose.
 */
export class ClassListPageDto extends createZodDto(listClassesPageSchema) {}

/** FR-005, FR-006, FR-007 / Route 14: the class detail projection. */
export class ClassDetailViewDto extends createZodDto(classDetailViewSchema) {}

/** FR-007, FR-009, FR-011, FR-020 / Route 22: the learner's bookings page. */
export class MyBookingsPageDto extends createZodDto(myBookingsPageSchema) {}
