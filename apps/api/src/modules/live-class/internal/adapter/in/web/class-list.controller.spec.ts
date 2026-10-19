import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { encodeClassCursor } from '@skillswap/contracts';
import { ClassListController } from './class-list.controller';
import type { ListClassesPort, ListClassesPageDto } from '../../../application/port/in/list-classes';
import type { RequestWithIdentity } from '../../../../../../shared/http/identity';

describe('ClassListController', () => {
  let mockListClassesPort: jest.Mocked<ListClassesPort>;
  let controller: ClassListController;

  beforeEach(() => {
    mockListClassesPort = {
      execute: jest.fn(),
    };
    controller = new ClassListController(mockListClassesPort);
  });

  const authRequest = (userId = 'user-123'): RequestWithIdentity => ({
    headers: { 'x-user-id': userId },
    user: { id: userId },
  });

  const anonRequest: RequestWithIdentity = {
    headers: {},
    user: { id: 'anonymous' },
  };

  it('rejects unauthenticated or anonymous callers with UnauthorizedException', async () => {
    await expect(controller.list({ limit: 20 }, anonRequest)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockListClassesPort.execute).not.toHaveBeenCalled();
  });

  it('delegates valid query to ListClassesPort and encodes nextCursor', async () => {
    const pageDto: ListClassesPageDto = {
      items: [
        {
          id: 'cls-1',
          teacherId: 'teacher-1',
          teacherDisplayName: 'Prof. Alice',
          skillIds: ['sk-1'],
          description: 'Introduction to Algorithms',
          startsAt: '2026-10-15T10:00:00.000Z',
          durationMinutes: 60,
          priceCredits: 100,
          capacity: 20,
          confirmedBookingsCount: 5,
          availableSeats: 15,
          state: 'published',
          averageRating: null,
          ratingsCount: 0,
        },
      ],
      nextCursor: ['2026-10-15T10:00:00.000Z', 'cls-1'],
    };

    mockListClassesPort.execute.mockResolvedValueOnce(pageDto);

    const result = await controller.list(
      {
        q: 'Algo',
        limit: 10,
      },
      authRequest('user-456'),
    );

    expect(mockListClassesPort.execute).toHaveBeenCalledWith({
      callerId: 'user-456',
      keyword: 'Algo',
      skillId: undefined,
      startDate: undefined,
      endDate: undefined,
      teacherId: undefined,
      state: undefined,
      limit: 10,
      cursor: undefined,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].teacherDisplayName).toBe('Prof. Alice');
    expect(result.nextCursor).toBe(encodeClassCursor(['2026-10-15T10:00:00.000Z', 'cls-1']));
    expect(result.totalActiveTeachingCount).toBeUndefined();
  });

  it('resolves the search term from the legacy keyword alias and prefers q', async () => {
    mockListClassesPort.execute.mockResolvedValue({ items: [], nextCursor: null });

    await controller.list({ keyword: 'legacy', limit: 20 }, authRequest('user-1'));
    expect(mockListClassesPort.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'legacy' }),
    );

    await controller.list(
      { q: 'canonical', keyword: 'legacy', limit: 20 },
      authRequest('user-1'),
    );
    expect(mockListClassesPort.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'canonical' }),
    );

    await controller.list({ limit: 20 }, authRequest('user-1'));
    expect(mockListClassesPort.execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: undefined }),
    );
  });

  it('passes decoded cursor to use case when cursor is provided', async () => {
    const rawCursor = encodeClassCursor(['2026-10-20T14:00:00.000Z', 'cls-99']);

    mockListClassesPort.execute.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
    });

    await controller.list(
      {
        cursor: rawCursor,
        limit: 20,
      },
      authRequest('user-1'),
    );

    expect(mockListClassesPort.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: ['2026-10-20T14:00:00.000Z', 'cls-99'],
      }),
    );
  });

  it('throws BadRequestException when cursor is malformed', async () => {
    await expect(
      controller.list(
        {
          cursor: 'malformed_base64url_string',
          limit: 20,
        },
        authRequest('user-1'),
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockListClassesPort.execute).not.toHaveBeenCalled();
  });

  it('includes totalActiveTeachingCount in own mode', async () => {
    mockListClassesPort.execute.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      totalActiveTeachingCount: 7,
    });

    const result = await controller.list(
      {
        teacherId: 'me',
        limit: 20,
      },
      authRequest('teacher-owner'),
    );

    expect(result.totalActiveTeachingCount).toBe(7);
  });
});
