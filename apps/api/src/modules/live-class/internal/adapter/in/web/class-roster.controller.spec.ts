import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ClassRosterController } from './class-roster.controller';
import type { GetClassRosterPort } from '../../../application/port/in/get-class-roster';
import { ClassRosterNotFoundError } from '../../../application/query/get-class-roster.query';
import type { RequestWithIdentity } from '../../../../../../shared/http/identity';

const CLASS_ID = '5eedc1a5-0000-4000-8000-000000000007';

function authRequest(userId: string): RequestWithIdentity {
  return { headers: { 'x-user-id': userId }, user: { id: userId } };
}

describe('ClassRosterController (FR-011 / ADR-040)', () => {
  let port: jest.Mocked<GetClassRosterPort>;
  let controller: ClassRosterController;

  beforeEach(() => {
    port = {
      execute: jest.fn().mockResolvedValue({ classId: CLASS_ID, capacity: 6, entries: [] }),
    };
    controller = new ClassRosterController(port);
  });

  it('binds the caller identity and never takes a teacher id from the request', async () => {
    await controller.getRoster(CLASS_ID, authRequest('teacher-1'));

    expect(port.execute).toHaveBeenCalledWith({ classId: CLASS_ID, callerId: 'teacher-1' });
  });

  it('rejects an anonymous caller with 401', async () => {
    await expect(
      controller.getRoster(CLASS_ID, { headers: {}, user: { id: 'anonymous' } }),
    ).rejects.toThrow(UnauthorizedException);
    expect(port.execute).not.toHaveBeenCalled();
  });

  it('turns a not-found into 404 so a stranger learns nothing about the class', async () => {
    port.execute.mockRejectedValueOnce(new ClassRosterNotFoundError(CLASS_ID));

    await expect(controller.getRoster(CLASS_ID, authRequest('stranger'))).rejects.toThrow(
      NotFoundException,
    );
  });
});
