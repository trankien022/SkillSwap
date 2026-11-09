import type { ClassRepository } from '../port/out/class-repository';
import type { ClassRosterEntry, ClassRosterReader } from '../port/out/class-roster-reader';
import type { PublicTeacherReader } from '../port/out/public-teacher-reader';
import {
  ClassRosterNotFoundError,
  GetClassRosterQueryHandler,
} from './get-class-roster.query';
import { classView } from '../testing/live-class-fakes';

const NOW = new Date('2026-11-10T10:00:00.000Z');

function seat(overrides: Partial<ClassRosterEntry> = {}): ClassRosterEntry {
  return {
    bookingId: 'booking-1',
    learnerId: 'learner-1',
    state: 'confirmed',
    createdAt: new Date('2026-11-01T09:00:00.000Z'),
    ...overrides,
  };
}

describe('GetClassRosterQueryHandler (FR-011 / ADR-040)', () => {
  let classes: jest.Mocked<Pick<ClassRepository, 'findById'>>;
  let roster: jest.Mocked<ClassRosterReader>;
  let profiles: jest.Mocked<PublicTeacherReader>;
  let handler: GetClassRosterQueryHandler;

  beforeEach(() => {
    classes = {
      findById: jest.fn().mockResolvedValue(classView({ id: 'cls-1', teacherId: 'teacher-1', capacity: 6 })),
    };
    roster = { findActiveSeats: jest.fn().mockResolvedValue([]) };
    profiles = { readMany: jest.fn().mockResolvedValue([]) };
    handler = new GetClassRosterQueryHandler(
      classes as unknown as ClassRepository,
      roster,
      profiles,
      { now: () => NOW },
    );
  });

  it('returns the seats with learner names resolved through the profile facade', async () => {
    roster.findActiveSeats.mockResolvedValueOnce([seat(), seat({ bookingId: 'booking-2', learnerId: 'learner-2' })]);
    profiles.readMany.mockResolvedValueOnce([
      { id: 'learner-1', displayName: 'Demo User 7' },
      { id: 'learner-2', displayName: 'Demo User 8' },
    ]);

    const result = await handler.execute({ classId: 'cls-1', callerId: 'teacher-1' });

    expect(result.classId).toBe('cls-1');
    expect(result.capacity).toBe(6);
    expect(result.entries.map((e) => e.displayName)).toEqual(['Demo User 7', 'Demo User 8']);
    expect(result.entries[0].createdAt).toBe('2026-11-01T09:00:00.000Z');
  });

  it('reads profiles once for the distinct learners, not once per seat', async () => {
    roster.findActiveSeats.mockResolvedValueOnce([
      seat(),
      seat({ bookingId: 'booking-2', learnerId: 'learner-2' }),
    ]);

    await handler.execute({ classId: 'cls-1', callerId: 'teacher-1' });

    expect(profiles.readMany).toHaveBeenCalledTimes(1);
    expect(profiles.readMany).toHaveBeenCalledWith(['learner-1', 'learner-2']);
  });

  it('never puts a raw id in the display name', async () => {
    roster.findActiveSeats.mockResolvedValueOnce([seat({ learnerId: 'learner-without-profile' })]);
    profiles.readMany.mockResolvedValueOnce([]);

    const result = await handler.execute({ classId: 'cls-1', callerId: 'teacher-1' });

    expect(result.entries[0].displayName).toBe('Learner');
    expect(result.entries[0].displayName).not.toContain('learner-without-profile');
  });

  it('refuses a caller who is not the class teacher, as not-found', async () => {
    await expect(
      handler.execute({ classId: 'cls-1', callerId: 'learner-1' }),
    ).rejects.toBeInstanceOf(ClassRosterNotFoundError);
    expect(roster.findActiveSeats).not.toHaveBeenCalled();
  });

  it('refuses a class that does not exist, as not-found', async () => {
    classes.findById.mockResolvedValueOnce(null);

    await expect(
      handler.execute({ classId: 'cls-missing', callerId: 'teacher-1' }),
    ).rejects.toBeInstanceOf(ClassRosterNotFoundError);
  });

  it('does not ask for profiles when nobody holds a seat', async () => {
    const result = await handler.execute({ classId: 'cls-1', callerId: 'teacher-1' });

    expect(result.entries).toEqual([]);
    expect(profiles.readMany).not.toHaveBeenCalled();
  });
});
