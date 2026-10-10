import { RequestRoomAccessUseCase, RoomUnavailableError, BookingNotFoundError } from './request-room-access.use-case';
import { RoomAccessDeniedError } from '../domain/room-access';
import type { Clock } from './port/out/clock';
import {
  FakeRoomIncidentRecorder,
  FakeRoomTokenIssuer,
  InMemoryBookingRepository,
  InMemoryClassRepository,
  classView,
  makeBooking,
} from './testing/live-class-fakes';

const STARTS_AT = new Date('2026-10-12T10:00:00.000Z');
const AT_START = new Date(STARTS_AT.getTime());

function setup(bookingState: 'confirmed' | 'pending' | 'cancelled' = 'confirmed', now = AT_START) {
  const classes = new InMemoryClassRepository(classView({ startsAt: STARTS_AT, teacherId: 'teacher-1' }));
  const bookings = new InMemoryBookingRepository([
    makeBooking({ id: 'b1', classId: 'cls-1', learnerId: 'learner-1', state: bookingState }),
  ]);
  const tokens = new FakeRoomTokenIssuer();
  const incidents = new FakeRoomIncidentRecorder();
  const clock: Clock = { now: () => now };
  const useCase = new RequestRoomAccessUseCase(
    bookings,
    classes,
    tokens,
    incidents,
    clock,
    'localhost:8443',
    15,
  );
  return { useCase, tokens, incidents };
}

describe('RequestRoomAccessUseCase (FR-011 / AC-006)', () => {
  it('issues a participant token to the learner with a join URL', async () => {
    const { useCase, tokens } = setup();
    const result = await useCase.execute({ bookingId: 'b1', requesterId: 'learner-1', displayName: 'An' });
    expect(result.room).toBe('skillswap-cls-1');
    expect(result.token).toBe('tok-participant');
    expect(result.url).toBe('https://localhost:8443/skillswap-cls-1');
    expect(tokens.issued[0]).toMatchObject({ role: 'participant', room: 'skillswap-cls-1' });
  });

  it('issues a moderator token to the teacher', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ bookingId: 'b1', requesterId: 'teacher-1' });
    expect(result.token).toBe('tok-moderator');
  });

  it('denies an outsider without issuing a token (AC-006)', async () => {
    const { useCase, tokens } = setup();
    await expect(useCase.execute({ bookingId: 'b1', requesterId: 'stranger' })).rejects.toThrow(
      RoomAccessDeniedError,
    );
    expect(tokens.issued).toHaveLength(0);
  });

  it('denies a cancelled booking and a closed window', async () => {
    const cancelled = setup('cancelled');
    await expect(
      cancelled.useCase.execute({ bookingId: 'b1', requesterId: 'learner-1' }),
    ).rejects.toThrow(RoomAccessDeniedError);

    const late = setup('confirmed', new Date(STARTS_AT.getTime() + 3 * 60 * 60 * 1000));
    await expect(late.useCase.execute({ bookingId: 'b1', requesterId: 'learner-1' })).rejects.toThrow(
      RoomAccessDeniedError,
    );
  });

  it('records an incident and reports unavailability when the provider fails (NFR-006/009)', async () => {
    const { useCase, tokens, incidents } = setup();
    tokens.fail = true;
    await expect(useCase.execute({ bookingId: 'b1', requesterId: 'learner-1' })).rejects.toThrow(
      RoomUnavailableError,
    );
    expect(incidents.incidents).toHaveLength(1);
    expect(incidents.incidents[0]).toMatchObject({ bookingId: 'b1', classId: 'cls-1' });
    expect(incidents.incidents[0].traceId).toMatch(/[0-9a-f-]{36}/);
  });

  it('throws when the booking does not exist', async () => {
    const { useCase } = setup();
    await expect(useCase.execute({ bookingId: 'missing', requesterId: 'learner-1' })).rejects.toThrow(
      BookingNotFoundError,
    );
  });
});
