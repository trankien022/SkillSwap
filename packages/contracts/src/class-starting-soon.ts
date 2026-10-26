import { z } from 'zod';

/**
 * FR-016 (W3): "class starting soon", the one notification trigger that had no producer.
 *
 * **One event per class, not one per participant.** The reminder is a fact about the class — it
 * became due — and the participants are the consequence of that fact. Emitting N events would
 * multiply outbox rows by seat count for the same instant, and would also make the reminder's
 * idempotency depend on N separate outbox inserts rather than the single claim that decided the
 * reminder was due. The consumer fans out to the inbox, where per-person deduplication already
 * exists.
 *
 * `participants` carries the role because the copy differs ("your class starts soon" versus "the
 * class you teach starts soon"), and because the consumer should not have to re-derive it from the
 * class — the booking that made this participant eligible is the authority, and it is gone from
 * the payload's perspective once the event is in flight.
 *
 * `startsAt` is included even though the class id would resolve it: the notification is rendered
 * later, possibly much later, and must state the time the reminder was about rather than whatever
 * the class says by then. A rescheduled class is a different class in effect, and a stale event
 * saying the old time is honest evidence of what the participant was told (W3 C3 accepts the same
 * staleness for a cancellation).
 */
export const classStartingSoonSchema = z.object({
  classId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
  participants: z
    .array(
      z.object({
        accountId: z.string().uuid(),
        role: z.enum(['learner', 'teacher']),
      }),
    )
    // A reminder nobody receives is not a reminder. Refusing the empty case at the contract
    // means a bug that loses the participants fails at publish time, where it is visible as a
    // DEAD row, instead of silently delivering nothing.
    .min(1),
});

export type ClassStartingSoon = z.infer<typeof classStartingSoonSchema>;

/** The exchange routing key, matching the `class.completed` / `class.cancelled` family. */
export const CLASS_STARTING_SOON_EVENT = 'class.starting.soon';
