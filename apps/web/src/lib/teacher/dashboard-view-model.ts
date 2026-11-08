/**
 * Pure view-model helpers for the teacher dashboard (FR-005 / FR-020 / FR-022).
 *
 * These live outside `page.tsx` for a hard reason, not tidiness: a Next.js page
 * file may only export the names Next recognises (`default`, `metadata`, and so
 * on). Exporting an interface or a function from a page compiles under `tsc`
 * but fails `next build` with "Property ... is incompatible with index
 * signature". Keeping them here means the page exports only its component, and
 * the mapping stays unit-testable on its own.
 */

/**
 * A class in the teacher's own list, mapped from `GET /classes?teacherId=me`.
 */
export interface TeacherClassItem {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
  confirmedBookingsCount: number;
  availableSeats: number;
  state: string;
}

/** One row of `GET /classes?teacherId=me`, mapped to the screen's view model. */
export function toTeacherClassItem(item: {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  durationMinutes: number;
  priceCredits: number;
  capacity: number;
  confirmedBookingsCount: number;
  availableSeats: number;
  state: string;
}): TeacherClassItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    startsAt: item.startsAt,
    durationMinutes: item.durationMinutes,
    priceCredits: item.priceCredits,
    capacity: item.capacity,
    confirmedBookingsCount: item.confirmedBookingsCount,
    availableSeats: item.availableSeats,
    state: item.state,
  };
}

/**
 * The editable subset of a class exposed on the teacher dashboard: title,
 * price, and capacity. Schedule changes interact with the 24 h booking lead
 * time and are deferred.
 */
export interface ClassEditDraft {
  title: string;
  priceCredits: number;
  capacity: number;
}

/**
 * Builds the `PATCH /classes/:id` body for an edit that has already been
 * validated locally.
 */
export function toUpdateClassInput(draft: ClassEditDraft): {
  title?: string;
  priceCredits?: number;
  capacity?: number;
} {
  return {
    title: draft.title.trim(),
    priceCredits: draft.priceCredits,
    capacity: draft.capacity,
  };
}

/**
 * Reads the API's own failure message from a non-2xx response, falling back to
 * a caller-supplied string when the body carries none. The uniform envelope
 * puts the human message on `message`.
 */
export async function readApiMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body?.message === 'string' && body.message.trim()) return body.message;
  } catch {
    // Non-JSON body; fall through to the caller's fallback.
  }
  return fallback;
}
