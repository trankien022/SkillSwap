import type { PresenceEventType } from '../../../domain/presence-webhook';

export const RECORD_PRESENCE = Symbol('RECORD_PRESENCE');

export interface RecordPresenceCommand {
  type: PresenceEventType;
  /** The room as Jitsi reports it, e.g. `skillswap-<classId>`. */
  room: string;
  /** The class the room name resolved to. */
  classId: string;
  /**
   * The authenticated occupant: the `context.user.id` claim of the issued token.
   *
   * Empty for `room-destroyed`, which 8x8 emits without any `data.id`: the event describes
   * the room, not a person, so it has no occupant to attribute.
   */
  accountId: string;
  occurredAt: Date;
}

/**
 * Reported, never thrown: a webhook is acknowledged, and its three refusals are
 * legitimate answers rather than errors.
 */
export type RecordPresenceResult =
  | { readonly accepted: true }
  | {
      readonly accepted: false;
      readonly reason: 'unknown_room' | 'not_a_party' | 'unknown_party';
    };

export interface RecordPresencePort {
  execute(command: RecordPresenceCommand): Promise<RecordPresenceResult>;
}
