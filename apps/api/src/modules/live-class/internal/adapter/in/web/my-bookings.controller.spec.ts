import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { encodeBookingCursor } from '@skillswap/contracts';
import { MyBookingsController } from './my-bookings.controller';
import type {
  ListMyBookingsPort,
  MyBookingsPageDto,
} from '../../../application/port/in/list-my-bookings';
import type { RequestWithIdentity } from '../../../../../../shared/http/identity';

describe('MyBookingsController', () => {
  let mockListMyBookings: jest.Mocked<ListMyBookingsPort>;
  let controller: MyBookingsController;

  const authRequest = (userId = 'learner-123'): RequestWithIdentity => ({
    headers: { 'x-user-id': userId },
    user: { id: userId },
  });

  const anonRequest: RequestWithIdentity = {
    headers: {},
    user: { id: 'anonymous' },
  };

  beforeEach(() => {
    mockListMyBookings = {
      execute: jest.fn(),
    };
    controller = new MyBookingsController(mockListMyBookings);
  });

  it('rejects unauthenticated or anonymous callers with UnauthorizedException (HTTP 401)', async () => {
    await expect(controller.listMe({ limit: 20 }, anonRequest)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockListMyBookings.execute).not.toHaveBeenCalled();
  });

  it('rejects malformed cursor with BadRequestException (HTTP 400)', async () => {
    await expect(
      controller.listMe(
        {
          cursor: 'malformed_cursor_string',
          limit: 20,
        },
        authRequest('learner-123'),
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockListMyBookings.execute).not.toHaveBeenCalled();
  });

  it('strictly binds learnerId to currentUserId and ignores any query override attempts', async () => {
    mockListMyBookings.execute.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      totalUpcomingCount: 0,
    });

    const maliciousQuery = {
      limit: 20,
      learnerId: 'victim-id',
      callerId: 'victim-id',
    } as unknown;

    await controller.listMe(maliciousQuery as never, authRequest('actual-caller-id'));

    expect(mockListMyBookings.execute).toHaveBeenCalledWith({
      learnerId: 'actual-caller-id',
      state: undefined,
      upcoming: undefined,
      limit: 20,
      cursor: undefined,
    });
  });

  it('delegates valid query with upcoming=true, state and decoded cursor to ListMyBookingsPort', async () => {
    const rawCursor = encodeBookingCursor(['2026-10-18T10:00:00.000Z', 'bk-cursor-1']);

    const samplePageDto: MyBookingsPageDto = {
      items: [
        {
          bookingId: 'bk-1',
          classId: 'cls-1',
          state: 'confirmed',
          priceCredits: 100,
          createdAt: '2026-10-12T08:00:00.000Z',
          expiresAt: null,
          classSummary: {
            description: 'Advanced Cloud Architecture',
            skillIds: ['sk-cloud-1'],
            startsAt: '2026-10-20T14:00:00.000Z',
            durationMinutes: 90,
            teacherId: 'teacher-1',
            teacherDisplayName: 'Prof. Turing',
            classState: 'published',
          },
          roomAccessEligible: false,
          ratingEligible: false,
          hasRated: false,
        },
      ],
      nextCursor: ['2026-10-20T14:00:00.000Z', 'bk-1'],
      totalUpcomingCount: 3,
    };

    mockListMyBookings.execute.mockResolvedValueOnce(samplePageDto);

    const result = await controller.listMe(
      {
        state: 'confirmed',
        upcoming: true,
        limit: 10,
        cursor: rawCursor,
      },
      authRequest('learner-abc'),
    );

    expect(mockListMyBookings.execute).toHaveBeenCalledWith({
      learnerId: 'learner-abc',
      state: 'confirmed',
      upcoming: true,
      limit: 10,
      cursor: ['2026-10-18T10:00:00.000Z', 'bk-cursor-1'],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].bookingId).toBe('bk-1');
    expect(result.items[0].classSummary.teacherDisplayName).toBe('Prof. Turing');
    expect(result.nextCursor).toBe(encodeBookingCursor(['2026-10-20T14:00:00.000Z', 'bk-1']));
    expect(result.totalUpcomingCount).toBe(3);
  });

  it('handles upcoming=false correctly', async () => {
    mockListMyBookings.execute.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      totalUpcomingCount: 2,
    });

    const result = await controller.listMe(
      {
        upcoming: false,
        limit: 20,
      },
      authRequest('learner-abc'),
    );

    expect(mockListMyBookings.execute).toHaveBeenCalledWith({
      learnerId: 'learner-abc',
      state: undefined,
      upcoming: false,
      limit: 20,
      cursor: undefined,
    });
    expect(result.totalUpcomingCount).toBe(2);
    expect(result.nextCursor).toBeNull();
  });
});
