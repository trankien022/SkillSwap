import { z } from 'zod';
import { classIdParamSchema } from './mobile-class-detail';

/**
 * FR-011 / ADR-040: the teacher's roster for their own class.
 *
 * The teacher's room entry point is keyed on the class, so the roster is too. Only active
 * seats appear — a cancelled seat or an expired hold is not "enrolled" and must not be shown
 * as if it were.
 *
 * Learner names arrive pre-resolved from the API, which reads them through the
 * `account-profile` facade rather than joining another schema (ADR-014). `displayName` is
 * required: the web teacher view has no honest fallback for a person, and an id would leak
 * into the UI (the raw-UUID defect found during flow testing).
 */
export const classRosterParamsSchema = z.object({
  id: classIdParamSchema,
});
export type ClassRosterParams = z.infer<typeof classRosterParamsSchema>;

export const classRosterEntrySchema = z.object({
  bookingId: z.string().min(1),
  learnerId: z.string().min(1),
  displayName: z.string().min(1),
  /** `pending` holds a seat until `expiresAt`; `confirmed` has settled. */
  state: z.enum(['pending', 'confirmed']),
  createdAt: z.string().datetime({ offset: true }),
});
export type ClassRosterEntryView = z.infer<typeof classRosterEntrySchema>;

export const classRosterSchema = z.object({
  classId: z.string().min(1),
  capacity: z.number().int().positive(),
  /** Every active seat, ordered by booking creation so the panel is stable between polls. */
  entries: z.array(classRosterEntrySchema),
});
export type ClassRosterView = z.infer<typeof classRosterSchema>;
