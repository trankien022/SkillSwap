/**
 * FR-012 in-class chat (ADR-036, amended by Amendment A). Pure domain — no framework, no
 * persistence (ADR-009).
 *
 * What this module decides is **who may speak and when**, not what they may say. The
 * contact-sharing rule ADR-036 originally carried was withdrawn before any code shipped
 * (Amendment A), so there is deliberately no `detectContactSharing` here and nothing that
 * inspects a body. That absence is the decision, not an omission.
 */

import type { ChatSenderRole } from '@skillswap/contracts';
import type { BookingState } from './booking';
import {
  DEFAULT_OPEN_MINUTES,
  JOINABLE_BOOKING_STATES,
  isWithinAccessWindow,
  partyRole,
  type RoomAccessClass,
} from './room-access';

/**
 * Why a chat request was refused.
 *
 * Deliberately split by cause rather than collapsed into one "denied": an outsider and a party
 * who is simply early need different HTTP answers (403 vs 409), and a client shows different
 * copy. Sharing a single reason would force the adapter to re-derive which case it was.
 */
export const CHAT_DENIALS = [
  'not_a_party',
  'booking_not_confirmed',
  'window_not_open',
  'window_closed',
] as const;
export type ChatDenial = (typeof CHAT_DENIALS)[number];

export class ChatAccessDeniedError extends Error {
  constructor(
    readonly reason: ChatDenial,
    message: string,
  ) {
    super(message);
    this.name = 'ChatAccessDeniedError';
  }
}

/**
 * The stable wire code for each refusal, so a client can branch without matching English.
 *
 * A `not_a_party` refusal and a `window_closed` one are different screens: the first is "this is
 * not yours", the second is "come back later". Collapsing them into one `HTTP_409` would force
 * every client to re-derive which it was from the message text.
 */
export function chatDenialCode(reason: ChatDenial): string {
  return reason === 'not_a_party' ? 'CHAT_NOT_A_PARTY' : 'CHAT_WINDOW_CLOSED';
}

export interface ChatBooking {
  id: string;
  classId: string;
  learnerId: string;
  state: BookingState;
}

export interface ChatRequest {
  booking: ChatBooking;
  classView: RoomAccessClass;
  requesterId: string;
  now: Date;
  openMinutes?: number;
}

function deny(reason: ChatDenial, message: string): never {
  throw new ChatAccessDeniedError(reason, message);
}

/**
 * Resolves the requester's role on this booking, or refuses.
 *
 * Order matters and is the same order `authorizeRoomAccess` uses: party first, then booking
 * state, then the window. A stranger asking about a class that has not started must be told
 * they are not a party, never that they are early — the second answer would confirm the class
 * exists and is live.
 */
export function resolveChatParticipant(request: ChatRequest): ChatSenderRole {
  const { booking, classView, requesterId, now } = request;

  const role = partyRole(booking, classView, requesterId);
  if (role === null) {
    deny('not_a_party', 'Requester is not a party to this booking');
  }

  if (!JOINABLE_BOOKING_STATES.includes(booking.state)) {
    deny('booking_not_confirmed', `Booking is ${booking.state}, not a confirmed conversation`);
  }

  const window = isWithinAccessWindow(classView, now, request.openMinutes ?? DEFAULT_OPEN_MINUTES);
  if (now.getTime() < window.opensAt.getTime()) {
    deny('window_not_open', 'Chat opens shortly before the class starts');
  }
  if (now.getTime() > window.closesAt.getTime()) {
    deny('window_closed', 'Chat has closed for this class');
  }

  return role;
}

/**
 * FR-012 / ADR-036 decision 3: **sending** is the windowed act; **reading** is not.
 *
 * A participant may read the history of their own booking indefinitely — the conversation is a
 * record of a class they attended, and hiding it afterwards would make the platform's copy
 * less useful than the user's own notes while claiming to be the recorded one. What the window
 * bounds is the right to add to it.
 *
 * These are separate functions rather than one with a flag because the two rules genuinely
 * differ and every future change to one must not silently move the other.
 */
export function assertCanSend(request: ChatRequest): ChatSenderRole {
  return resolveChatParticipant(request);
}

export function assertCanRead(request: ChatRequest): ChatSenderRole {
  const { booking, classView, requesterId } = request;

  const role = partyRole(booking, classView, requesterId);
  if (role === null) {
    deny('not_a_party', 'Requester is not a party to this booking');
  }

  // Reading is *not* gated on `confirmed`: a booking that was cancelled still has a history, and
  // the learner who paid for that class is the person most entitled to it. The window is not
  // consulted either. Only `pending` is refused, because a hold that was never confirmed never
  // had a conversation to read — there is nothing to protect by letting it through, and letting
  // it through would let an unconfirmed hold read a class's chat by racing another learner's
  // confirmed one.
  if (booking.state === 'pending') {
    deny('booking_not_confirmed', 'A pending booking has no conversation to read');
  }

  return role;
}
