import { GetClassDetailQueryHandler } from './get-class-detail.query';
import { ClassDetailNotFoundError } from '../port/in/get-class-detail';
import type {
  ClassDetailReader,
  ClassDetailRecord,
} from '../port/out/class-detail-reader';
import type { Clock } from '../port/out/clock';
import type { ClassSkillReader } from '../port/out/class-skill-reader';
import type { PublicTeacherReader } from '../port/out/public-teacher-reader';

describe('GetClassDetailQueryHandler', () => {
  const fixedNow = new Date('2026-10-12T12:00:00.000Z');
  const leadTime24h = 24 * 60 * 60 * 1000;
  const startsAt25h = new Date(fixedNow.getTime() + leadTime24h + 60 * 60 * 1000);

  let mockClassDetailReader: jest.Mocked<ClassDetailReader>;
  let mockPublicTeacherReader: jest.Mocked<PublicTeacherReader>;
  let mockClassSkillReader: jest.Mocked<ClassSkillReader>;
  let mockClock: Clock;
  let handler: GetClassDetailQueryHandler;

  const baseRecord: ClassDetailRecord = {
    id: 'cls-11111111-1111-4111-8111-111111111111',
    teacherId: 'teacher-uuid-1',
    skillIds: ['sk-math', 'sk-physics'],
    description: 'Advanced Quantum Mechanics',
    startsAt: startsAt25h,
    durationMinutes: 90,
    priceCredits: 100,
    capacity: 10,
    confirmedBookingsCount: 2,
    heldSeatsCount: 2,
    availableSeats: 8,
    state: 'published',
    callerBookings: [],
  };

  beforeEach(() => {
    mockClassDetailReader = {
      readDetail: jest.fn().mockResolvedValue(baseRecord),
    };
    mockPublicTeacherReader = {
      readMany: jest.fn().mockResolvedValue([
        { id: 'teacher-uuid-1', displayName: 'Prof. Heisenberg' },
      ]),
    };
    mockClock = {
      now: () => fixedNow,
    };
    mockClassSkillReader = {
      readMany: jest.fn().mockResolvedValue([
        { id: 'sk-math', name: 'Mathematics', category: 'Math', levels: ['beginner', 'intermediate'] },
        { id: 'sk-physics', name: 'Physics', category: 'Science', levels: ['intermediate'] },
      ]),
    };
    handler = new GetClassDetailQueryHandler(
      mockClassDetailReader,
      mockPublicTeacherReader,
      mockClassSkillReader,
      mockClock,
    );
  });

  describe('Skill catalogue enrichment (FR-006)', () => {
    it("reports the class's skills in skillIds order with their catalogue facts", async () => {
      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'stranger-caller',
      });

      expect(mockClassSkillReader.readMany).toHaveBeenCalledWith(['sk-math', 'sk-physics']);
      expect(result.skills).toEqual([
        { id: 'sk-math', name: 'Mathematics', category: 'Math', levels: ['beginner', 'intermediate'] },
        { id: 'sk-physics', name: 'Physics', category: 'Science', levels: ['intermediate'] },
      ]);
      expect(result.skillIds).toEqual(['sk-math', 'sk-physics']);
    });

    it('omits skills the catalogue does not confirm instead of inventing them', async () => {
      mockClassSkillReader.readMany.mockResolvedValueOnce([
        { id: 'sk-physics', name: 'Physics', category: 'Science', levels: [] },
      ]);

      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'stranger-caller',
      });

      expect(result.skills).toEqual([
        { id: 'sk-physics', name: 'Physics', category: 'Science', levels: [] },
      ]);
    });

    it('omits the field entirely when the catalogue read fails, without failing the page', async () => {
      mockClassSkillReader.readMany.mockRejectedValueOnce(new Error('catalogue down'));

      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'stranger-caller',
      });

      expect(result.skills).toBeUndefined();
      expect(result).not.toHaveProperty('skills');
      expect(result.id).toBe(baseRecord.id);
    });

    it('reports an empty list for a class with no skills', async () => {
      mockClassDetailReader.readDetail.mockResolvedValueOnce({ ...baseRecord, skillIds: [] });

      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'stranger-caller',
      });

      expect(mockClassSkillReader.readMany).not.toHaveBeenCalled();
      expect(result.skills).toEqual([]);
    });
  });

  describe('Absence and not-found behavior', () => {
    it('throws ClassDetailNotFoundError when class does not exist in persistence', async () => {
      mockClassDetailReader.readDetail.mockResolvedValueOnce(null);

      await expect(
        handler.execute({
          classId: 'cls-non-existent',
          callerId: 'learner-1',
        }),
      ).rejects.toThrow(ClassDetailNotFoundError);
    });
  });

  describe('Visibility rules', () => {
    it('throws ClassDetailNotFoundError when draft class is accessed by an outsider', async () => {
      mockClassDetailReader.readDetail.mockResolvedValueOnce({
        ...baseRecord,
        state: 'draft',
      });

      await expect(
        handler.execute({
          classId: baseRecord.id,
          callerId: 'outsider-student',
        }),
      ).rejects.toThrow(ClassDetailNotFoundError);
    });

    it('allows owning teacher to access their own draft class', async () => {
      mockClassDetailReader.readDetail.mockResolvedValueOnce({
        ...baseRecord,
        state: 'draft',
      });

      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: baseRecord.teacherId,
      });

      expect(result.id).toBe(baseRecord.id);
      expect(result.state).toBe('draft');
      expect(result.canBook).toBe(false);
    });

    it('allows any authenticated caller to view published and full classes at any scheduled time', async () => {      mockClassDetailReader.readDetail.mockResolvedValueOnce({
        ...baseRecord,
        state: 'full',
        availableSeats: 0,
      });

      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'stranger-caller',
      });

      expect(result.id).toBe(baseRecord.id);
      expect(result.state).toBe('full');
      expect(result.availableSeats).toBe(0);
    });

    it('throws ClassDetailNotFoundError when stranger accesses in_progress, completed, or cancelled class', async () => {
      for (const terminalState of ['in_progress', 'completed', 'cancelled'] as const) {
        mockClassDetailReader.readDetail.mockResolvedValueOnce({
          ...baseRecord,
          state: terminalState,
          callerBookings: [],
        });

        await expect(
          handler.execute({
            classId: baseRecord.id,
            callerId: 'stranger-caller',
          }),
        ).rejects.toThrow(ClassDetailNotFoundError);
      }
    });

    it('allows owning teacher to access terminal classes', async () => {
      for (const terminalState of ['in_progress', 'completed', 'cancelled'] as const) {
        mockClassDetailReader.readDetail.mockResolvedValueOnce({
          ...baseRecord,
          state: terminalState,
          callerBookings: [],
        });

        const result = await handler.execute({
          classId: baseRecord.id,
          callerId: baseRecord.teacherId,
        });

        expect(result.id).toBe(baseRecord.id);
        expect(result.state).toBe(terminalState);
      }
    });

    it('allows booked learner to access terminal classes with their historical booking', async () => {
      for (const terminalState of ['in_progress', 'completed', 'cancelled'] as const) {
        mockClassDetailReader.readDetail.mockResolvedValueOnce({
          ...baseRecord,
          state: terminalState,
          callerBookings: [
            {
              id: 'bk-historical-1',
              state: 'confirmed',
              expiresAt: null,
              createdAt: new Date('2026-10-10T10:00:00.000Z'),
            },
          ],
        });

        const result = await handler.execute({
          classId: baseRecord.id,
          callerId: 'booked-learner',
        });

        expect(result.id).toBe(baseRecord.id);
        expect(result.state).toBe(terminalState);
        expect(result.ownBooking).toEqual({
          bookingId: 'bk-historical-1',
          state: 'confirmed',
          expiresAt: null,
        });
      }
    });
  });

  describe('ownBooking summary calculation', () => {
    it('returns null when caller has no bookings', async () => {
      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'learner-no-booking',
      });

      expect(result.ownBooking).toBeNull();
    });

    it('returns the most recent booking when caller has multiple bookings', async () => {
      mockClassDetailReader.readDetail.mockResolvedValueOnce({
        ...baseRecord,
        callerBookings: [
          {
            id: 'bk-latest',
            state: 'pending',
            expiresAt: new Date(fixedNow.getTime() + 15 * 60 * 1000),
            createdAt: new Date('2026-10-12T11:00:00.000Z'),
          },
          {
            id: 'bk-old',
            state: 'cancelled',
            expiresAt: null,
            createdAt: new Date('2026-10-10T09:00:00.000Z'),
          },
        ],
      });

      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'learner-multi',
      });

      expect(result.ownBooking).toEqual({
        bookingId: 'bk-latest',
        state: 'pending',
        expiresAt: new Date(fixedNow.getTime() + 15 * 60 * 1000).toISOString(),
      });
    });
  });

  describe('canBook calculation', () => {
    it('returns canBook=true when class is published, availableSeats>0, startsAt>=now+24h, caller!=teacher, no active booking', async () => {
      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'eligible-learner',
      });

      expect(result.canBook).toBe(true);
    });

    it('handles exact 24h edge: startsAt == now + 24h is eligible, but now + 24h - 1ms is not', async () => {
      // Exactly 24h
      mockClassDetailReader.readDetail.mockResolvedValueOnce({
        ...baseRecord,
        startsAt: new Date(fixedNow.getTime() + leadTime24h),
      });

      const exact = await handler.execute({
        classId: baseRecord.id,
        callerId: 'learner-edge',
      });
      expect(exact.canBook).toBe(true);

      // 1ms less than 24h
      mockClassDetailReader.readDetail.mockResolvedValueOnce({
        ...baseRecord,
        startsAt: new Date(fixedNow.getTime() + leadTime24h - 1),
      });

      const under24h = await handler.execute({
        classId: baseRecord.id,
        callerId: 'learner-edge',
      });
      expect(under24h.canBook).toBe(false);
    });

    it('returns canBook=false when caller is the owning teacher', async () => {
      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: baseRecord.teacherId,
      });

      expect(result.canBook).toBe(false);
    });

    it('returns canBook=false when availableSeats is 0', async () => {
      mockClassDetailReader.readDetail.mockResolvedValueOnce({
        ...baseRecord,
        availableSeats: 0,
      });

      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'learner-1',
      });

      expect(result.canBook).toBe(false);
    });

    it('returns canBook=false when state is full, cancelled, completed, in_progress, or draft', async () => {
      for (const st of ['full', 'cancelled', 'completed', 'in_progress', 'draft'] as const) {
        mockClassDetailReader.readDetail.mockResolvedValueOnce({
          ...baseRecord,
          state: st,
          callerBookings: [
            {
              id: 'bk-1',
              state: 'confirmed',
              expiresAt: null,
              createdAt: new Date(),
            },
          ],
        });

        const result = await handler.execute({
          classId: baseRecord.id,
          callerId: st === 'draft' ? baseRecord.teacherId : 'some-caller',
        });

        expect(result.canBook).toBe(false);
      }
    });

    it('returns canBook=false when caller has an active pending booking (pending duplicate)', async () => {
      mockClassDetailReader.readDetail.mockResolvedValueOnce({
        ...baseRecord,
        callerBookings: [
          {
            id: 'bk-pending-active',
            state: 'pending',
            expiresAt: new Date(fixedNow.getTime() + 5 * 60 * 1000),
            createdAt: new Date(),
          },
        ],
      });

      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'learner-pending',
      });

      expect(result.canBook).toBe(false);
    });

    it('returns canBook=false when caller has confirmed or completed booking', async () => {
      for (const blockingState of ['confirmed', 'completed'] as const) {
        mockClassDetailReader.readDetail.mockResolvedValueOnce({
          ...baseRecord,
          callerBookings: [
            {
              id: 'bk-blocking',
              state: blockingState,
              expiresAt: null,
              createdAt: new Date(),
            },
          ],
        });

        const result = await handler.execute({
          classId: baseRecord.id,
          callerId: 'learner-dup',
        });

        expect(result.canBook).toBe(false);
      }
    });

    it('returns canBook=true when caller only has a cancelled booking or expired pending booking', async () => {
      mockClassDetailReader.readDetail.mockResolvedValueOnce({
        ...baseRecord,
        callerBookings: [
          {
            id: 'bk-cancelled',
            state: 'cancelled',
            expiresAt: null,
            createdAt: new Date('2026-10-10T00:00:00.000Z'),
          },
          {
            id: 'bk-expired-pending',
            state: 'pending',
            expiresAt: new Date(fixedNow.getTime() - 60 * 1000), // expired 1 min ago
            createdAt: new Date('2026-10-11T00:00:00.000Z'),
          },
        ],
      });

      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'learner-rebook',
      });

      expect(result.canBook).toBe(true);
    });
  });

  describe('Teacher display name enrichment and provisional ratings', () => {
    it('enriches teacher name and supplies provisional rating defaults', async () => {
      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'learner-1',
      });

      expect(mockPublicTeacherReader.readMany).toHaveBeenCalledWith([baseRecord.teacherId]);
      expect(result.teacher).toEqual({
        id: baseRecord.teacherId,
        displayName: 'Prof. Heisenberg',
        averageRating: null,
        ratingsCount: 0,
      });
      expect(result.recentRatings).toEqual([]);
    });

    it('falls back to SkillSwap when teacher profile is absent or empty', async () => {
      mockPublicTeacherReader.readMany.mockResolvedValueOnce([]);

      const result = await handler.execute({
        classId: baseRecord.id,
        callerId: 'learner-1',
      });

      expect(result.teacher.displayName).toBe('SkillSwap');
    });
  });
});
