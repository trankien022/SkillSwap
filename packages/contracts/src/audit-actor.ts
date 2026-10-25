import { z } from 'zod';

/**
 * ADR-035 C2: the account id recorded when an audited action had no human actor.
 *
 * Auto-cancel on teacher no-show (OQ-003), auto-complete at `starts_at + duration` (OQ-006), the
 * revocation cascade (ADR-025) and IPN settlement all act on their own. They are attributed to
 * this constant rather than to `NULL`.
 *
 * Why the constant exists at all: `NULL` must keep exactly one meaning — *written before ADR-035,
 * or unknown*. If `NULL` also meant "the system", a reader could not tell an honest gap from a
 * deliberate attribution, and the Product Owner's no-backfill ruling (C3) would be invisible in
 * the data it applies to.
 *
 * Why it is a v4-shaped UUID: every consumer stores the actor in a `uuid` column and validates it
 * like any other account id, so a sentinel of another shape would need a special case in every
 * read path. Being indistinguishable in *shape* is the point; it is distinguishable in *value*,
 * and it is never rendered as a person.
 */
export const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000000';

/** ADR-035 C1: the actor of an audited action is always present on the wire. */
export const actorIdSchema = z.string().uuid();

/**
 * The actor field shared by every audited event payload (ADR-035).
 *
 * Required, not optional. The whole value of this decision is that a future producer cannot forget
 * it: an absent actor fails schema validation at publish time, which the relay records as a `DEAD`
 * row (ADR-013 Amendment A, C2) instead of quietly writing an unattributed audit row that looks
 * like a legacy one.
 */
export const actorFields = {
  actorId: actorIdSchema,
} as const;

/** True when this actor is the system rather than a person. */
export function isSystemActor(actorId: string | null | undefined): boolean {
  return actorId === SYSTEM_ACTOR_ID;
}
