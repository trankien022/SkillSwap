import {
  ChatAccessDeniedError,
  assertCanRead,
  assertCanSend,
} from './chat';
import { roomName } from './room-access';
import type { BookingState } from './booking';

const LEARNER = '7c1e0000-0000-4000-8000-0000000000bb';
const TEACHER = '7c1e0000-0000-4000-8000-0000000000cc';
const STRANGER = '7c1e0000-0000-4000-8000-0000000000dd';
const CLASS_ID = '7c1e0000-0000-4000-8000-0000000000aa';

const STARTS_AT = new Date('2026-10-26T10:00:00.000Z');

function request(overrides: {
  state?: BookingState;
  now?: Date;
  requesterId?: string;
  durationMinutes?: number;
} = {}) {
  return {
    booking: { id: 'b1', classId: CLASS_ID, learnerId: LEARNER, state: overrides.state ?? 'confirmed' as BookingState },
    classView: { teacherId: TEACHER, startsAt: STARTS_AT, durationMinutes: overrides.durationMinutes ?? 60 },
    requesterId: overrides.requesterId ?? LEARNER,
    now: overrides.now ?? STARTS_AT,
  };
}

function minutesFromStart(minutes: number): Date {
  return new Date(STARTS_AT.getTime() + minutes * 60 * 1000);
}

function denial(run: () => unknown): string | null {
  try {
    run();
    return null;
  } catch (error) {
    if (error instanceof ChatAccessDeniedError) {
      return error.reason;
    }
    throw error;
  }
}

describe('FR-012 chat authorisation (ADR-036)', () => {
  describe('sending', () => {
    it('resolves the learner and the teacher by their role on the booking', () => {
      expect(assertCanSend(request())).toBe('learner');
      expect(assertCanSend(request({ requesterId: TEACHER }))).toBe('teacher');
    });

    it('refuses a stranger before it says anything about the class', () => {
      // A stranger must not learn from the refusal that the class is live or that it exists.
      expect(denial(() => assertCanSend(request({ requesterId: STRANGER })))).toBe('not_a_party');
      // Even outside the window, the answer is still "not a party", never "window closed".
      expect(
        denial(() => assertCanSend(request({ requesterId: STRANGER, now: minutesFromStart(999) }))),
      ).toBe('not_a_party');
    });

    it('opens exactly 15 minutes before the class, the same window as the door', () => {
      // ADR-036 decision 2: one window, read from the shared room rule rather than re-derived.
      // Bounds are written as literals on purpose -- deriving them from DEFAULT_OPEN_MINUTES
      // would make this case pass for any value of it, which is how a tautological test hides
      // a window that has drifted.
      expect(denial(() => assertCanSend(request({ now: minutesFromStart(-16) })))).toBe(
        'window_not_open',
      );
      expect(assertCanSend(request({ now: minutesFromStart(-15) }))).toBe('learner');
      expect(assertCanSend(request({ now: STARTS_AT }))).toBe('learner');
    });

    it('closes exactly when the door closes', () => {
      expect(assertCanSend(request({ now: minutesFromStart(60) }))).toBe('learner');
      expect(denial(() => assertCanSend(request({ now: minutesFromStart(61) })))).toBe('window_closed');
    });

    it('refuses every booking state that is not confirmed', () => {
      for (const state of ['pending', 'completed', 'cancelled'] as const) {
        expect(denial(() => assertCanSend(request({ state })))).toBe('booking_not_confirmed');
      }
    });

    it('reports the booking state before the window, because a cancelled class is cancelled', () => {
      // A cancelled booking at a time inside the window must not report "window" anything.
      expect(
        denial(() => assertCanSend(request({ state: 'cancelled', now: STARTS_AT }))),
      ).toBe('booking_not_confirmed');
    });

    it('honours a configurable open window', () => {
      const req = { ...request({ now: minutesFromStart(-20) }), openMinutes: 30 };
      expect(assertCanSend(req)).toBe('learner');
    });
  });

  describe('reading', () => {
    it('keeps history readable long after the window closes', () => {
      // ADR-036 decision 3.
      expect(assertCanRead(request({ now: minutesFromStart(60 * 24 * 30) }))).toBe('learner');
    });

    it('keeps a cancelled booking history readable to the person who paid for it', () => {
      expect(assertCanRead(request({ state: 'cancelled' }))).toBe('learner');
    });

    it('refuses a pending hold, which never had a conversation', () => {
      expect(denial(() => assertCanRead(request({ state: 'pending' })))).toBe('booking_not_confirmed');
    });

    it('refuses a stranger', () => {
      expect(denial(() => assertCanRead(request({ requesterId: STRANGER })))).toBe('not_a_party');
    });
  });

  describe('no content rule exists', () => {
    it('has no detector to call', () => {
      // BR-056 was withdrawn (ADR-036 Amendment A). This asserts the absence rather than
      // trusting a reader to notice it: if someone ever reintroduces content inspection, it
      // will not be here, and adding it means a new decision and a new ADR.
      const chatDomain = jest.requireActual('./chat') as Record<string, unknown>;
      const contentInspectors = Object.keys(chatDomain).filter((key) =>
        /detect|contact|blocked|flagged/i.test(key),
      );
      expect(contentInspectors).toEqual([]);
    });

    it('names the room through the shared room rule', () => {
      // The room name is what a participant sees; chat and the door must agree on it.
      expect(roomName(CLASS_ID)).toBe(`skillswap-${CLASS_ID}`);
    });
  });
});
