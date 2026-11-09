import { ClassesController } from './classes.controller';
import type { RequestWithIdentity } from '../../../../../../shared/http/identity';
import type { RequestTeacherRoomAccessPort } from '../../../application/port/in/request-teacher-room-access';
import type { RequestRoomAccessPort } from '../../../application/port/in/request-room-access';
import type { CreateClassPort } from '../../../application/port/in/create-class';
import type { UpdateClassPort } from '../../../application/port/in/update-class';
import type { BookClassPort } from '../../../application/port/in/book-class';
import type { ConfirmBookingPort } from '../../../application/port/in/confirm-booking';
import type { CancelClassPort } from '../../../application/port/in/cancel-class';
import type { MarkTeacherNoShowPort } from '../../../application/port/in/mark-teacher-no-show';
import type { StartClassPort } from '../../../application/port/in/start-class';

const CLASS_ID = '5eedc1a5-0000-4000-8000-000000000007';

function authRequest(userId: string): RequestWithIdentity {
  return { headers: { 'x-user-id': userId }, user: { id: userId } };
}

/**
 * FR-011 / ADR-040: the teacher room entry point is keyed on the class, and the requester's
 * identity must come from the verified JWT. These tests pin the second half of that: a caller
 * cannot supply a teacher id, because a moderator token can end a conference.
 */
describe('ClassesController teacher room access (FR-011 / ADR-040)', () => {
  let teacherRoomAccess: jest.Mocked<RequestTeacherRoomAccessPort>;
  let controller: ClassesController;

  beforeEach(() => {
    teacherRoomAccess = { execute: jest.fn().mockResolvedValue({ room: 'skillswap-x' }) };
    controller = new ClassesController(
      {} as CreateClassPort,
      {} as UpdateClassPort,
      {} as BookClassPort,
      {} as ConfirmBookingPort,
      {} as CancelClassPort,
      {} as MarkTeacherNoShowPort,
      {} as RequestRoomAccessPort,
      teacherRoomAccess,
      {} as StartClassPort,
    );
  });

  it('passes the caller identity from the request, never from the body', async () => {
    await controller.roomAccessForTeacher(
      CLASS_ID,
      { displayName: 'Demo User 1', requesterId: 'someone-else' } as never,
      authRequest('teacher-1'),
    );

    expect(teacherRoomAccess.execute).toHaveBeenCalledWith({
      classId: CLASS_ID,
      requesterId: 'teacher-1',
      displayName: 'Demo User 1',
    });
  });

  it('forwards the display name so the JaaS prejoin shows a person, not an id', async () => {
    await controller.roomAccessForTeacher(
      CLASS_ID,
      { displayName: 'Demo User 1' },
      authRequest('teacher-1'),
    );

    expect(teacherRoomAccess.execute).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Demo User 1' }),
    );
  });
});
