import {
  RequestTeacherRoomAccessUseCase,
  RoomUnavailableError,
  TeacherClassNotFoundError,
} from './request-teacher-room-access.use-case';
import { RoomAccessDeniedError } from '../domain/room-access';
import type { Clock } from './port/out/clock';
import {
  FakeRoomIncidentRecorder,
  FakeRoomTokenIssuer,
  InMemoryClassRepository,
  classView,
} from './testing/live-class-fakes';

const STARTS_AT = new Date('2026-10-12T10:00:00.000Z');
const AT_START = new Date(STARTS_AT.getTime());

function setup(
  overrides: { state?: 'draft' | 'published' | 'full' | 'in_progress' | 'completed' | 'cancelled'; now?: Date } = {},
) {
  const classes = new InMemoryClassRepository(
    classView({ startsAt: STARTS_AT, teacherId: 'teacher-1', state: overrides.state ?? 'published' }),
  );
  const tokens = new FakeRoomTokenIssuer();
  const incidents = new FakeRoomIncidentRecorder();
  const clock: Clock = { now: () => overrides.now ?? AT_START };
  const useCase = new RequestTeacherRoomAccessUseCase(
    classes,
    tokens,
    incidents,
    clock,
    '8x8.vc/app-id',
    15,
  );
  return { useCase, tokens, incidents };
}

describe('RequestTeacherRoomAccessUseCase (FR-011 / ADR-040)', () => {
  it('issues a moderator token to the class teacher', async () => {
    const { useCase, tokens } = setup();
    const result = await useCase.execute({
      classId: 'cls-1',
      requesterId: 'teacher-1',
      displayName: 'Demo User 1',
    });

    expect(result.room).toBe('skillswap-cls-1');
    expect(result.url).toBe('https://8x8.vc/app-id/skillswap-cls-1');
    expect(tokens.issued[0]).toMatchObject({
      room: 'skillswap-cls-1',
      userId: 'teacher-1',
      displayName: 'Demo User 1',
      role: 'moderator',
    });
  });

  it('joins the same room name the learner path derives for that class', async () => {
    const { useCase } = setup();
    const result = await useCase.execute({ classId: 'cls-1', requesterId: 'teacher-1' });
    // The learner path builds `roomName(booking.classId)`; the teacher path must agree or the
    // two parties end up in different conferences.
    expect(result.room).toBe('skillswap-cls-1');
  });

  it('refuses a class that does not exist', async () => {
    const { useCase } = setup();
    await expect(
      useCase.execute({ classId: 'cls-missing', requesterId: 'teacher-1' }),
    ).rejects.toBeInstanceOf(TeacherClassNotFoundError);
  });

  it('refuses a requester who is not the class teacher', async () => {
    const { useCase, tokens } = setup();
    await expect(
      useCase.execute({ classId: 'cls-1', requesterId: 'learner-1' }),
    ).rejects.toBeInstanceOf(RoomAccessDeniedError);
    expect(tokens.issued).toHaveLength(0);
  });

  it('refuses a class state the teacher cannot open', async () => {
    for (const state of ['draft', 'completed', 'cancelled'] as const) {
      const { useCase } = setup({ state });
      await expect(
        useCase.execute({ classId: 'cls-1', requesterId: 'teacher-1' }),
      ).rejects.toMatchObject({ reason: 'class_not_joinable' });
    }
  });

  it('refuses outside the window, and allows inside it', async () => {
    const beforeWindow = setup({ now: new Date(STARTS_AT.getTime() - 60 * 60 * 1000) });
    await expect(
      beforeWindow.useCase.execute({ classId: 'cls-1', requesterId: 'teacher-1' }),
    ).rejects.toMatchObject({ reason: 'window_not_open' });

    const afterWindow = setup({ now: new Date(STARTS_AT.getTime() + 61 * 60 * 1000) });
    await expect(
      afterWindow.useCase.execute({ classId: 'cls-1', requesterId: 'teacher-1' }),
    ).rejects.toMatchObject({ reason: 'window_closed' });

    const justOpened = setup({ now: new Date(STARTS_AT.getTime() - 15 * 60 * 1000) });
    await expect(
      justOpened.useCase.execute({ classId: 'cls-1', requesterId: 'teacher-1' }),
    ).resolves.toMatchObject({ room: 'skillswap-cls-1' });
  });

  it('records an incident and reports unavailability when the provider fails', async () => {
    const { useCase, tokens, incidents } = setup();
    tokens.fail = true;

    await expect(
      useCase.execute({ classId: 'cls-1', requesterId: 'teacher-1' }),
    ).rejects.toBeInstanceOf(RoomUnavailableError);

    expect(incidents.incidents).toHaveLength(1);
    expect(incidents.incidents[0]).toMatchObject({
      classId: 'cls-1',
      requesterId: 'teacher-1',
      reason: 'jitsi down',
    });
  });
});
