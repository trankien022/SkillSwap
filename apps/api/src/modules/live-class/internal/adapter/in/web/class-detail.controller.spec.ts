import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ClassDetailController } from './class-detail.controller';
import {
  ClassDetailNotFoundError,
  type ClassDetailDto,
  type GetClassDetailPort,
} from '../../../application/port/in/get-class-detail';
import type { RequestWithIdentity } from '../../../../../../shared/http/identity';

describe('ClassDetailController', () => {
  let mockGetClassDetailPort: jest.Mocked<GetClassDetailPort>;
  let controller: ClassDetailController;

  const validClassId = '123e4567-e89b-12d3-a456-426614174000';

  const authRequest = (userId = 'user-123'): RequestWithIdentity => ({
    headers: { 'x-user-id': userId },
    user: { id: userId },
  });

  const anonRequest: RequestWithIdentity = {
    headers: {},
    user: { id: 'anonymous' },
  };

  beforeEach(() => {
    mockGetClassDetailPort = {
      execute: jest.fn(),
    };
    controller = new ClassDetailController(mockGetClassDetailPort);
  });

  it('rejects unauthenticated or anonymous callers with UnauthorizedException', async () => {
    await expect(controller.getDetail(validClassId, anonRequest)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockGetClassDetailPort.execute).not.toHaveBeenCalled();
  });

  it('rejects non-UUID class IDs with BadRequestException', async () => {
    await expect(controller.getDetail('not-a-valid-uuid', authRequest())).rejects.toThrow(
      BadRequestException,
    );
    expect(mockGetClassDetailPort.execute).not.toHaveBeenCalled();
  });

  it('maps ClassDetailNotFoundError to NotFoundException (HTTP 404)', async () => {
    mockGetClassDetailPort.execute.mockRejectedValueOnce(
      new ClassDetailNotFoundError(validClassId),
    );

    await expect(controller.getDetail(validClassId, authRequest())).rejects.toThrow(
      NotFoundException,
    );
    expect(mockGetClassDetailPort.execute).toHaveBeenCalledWith({
      classId: validClassId,
      callerId: 'user-123',
    });
  });

  it('delegates to GetClassDetailPort and returns validated ClassDetailView', async () => {
    const detailDto: ClassDetailDto = {
      id: validClassId,
      teacher: {
        id: 'tch-1',
        displayName: 'Dr. Jane Doe',
        averageRating: null,
        ratingsCount: 0,
      },
      skillIds: ['sk-math-1'],
      description: 'Linear Algebra',
      startsAt: '2026-10-15T10:00:00.000Z',
      durationMinutes: 60,
      priceCredits: 100,
      capacity: 10,
      availableSeats: 7,
      state: 'published',
      canBook: true,
      recentRatings: [],
      ownBooking: {
        bookingId: 'bk-1',
        state: 'pending',
        expiresAt: '2026-10-14T10:15:00.000Z',
      },
    };

    mockGetClassDetailPort.execute.mockResolvedValueOnce(detailDto);

    const result = await controller.getDetail(validClassId, authRequest('user-456'));

    expect(mockGetClassDetailPort.execute).toHaveBeenCalledWith({
      classId: validClassId,
      callerId: 'user-456',
    });

    expect(result).toEqual(detailDto);
    expect(result.id).toBe(validClassId);
    expect(result.teacher.displayName).toBe('Dr. Jane Doe');
    expect(result.canBook).toBe(true);
    expect(result.ownBooking?.bookingId).toBe('bk-1');
  });
});
