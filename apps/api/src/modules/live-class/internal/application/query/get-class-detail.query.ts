import {
  ClassDetailNotFoundError,
  type ClassDetailDto,
  type ClassDetailSkillDto,
  type ClassDetailTeacherDto,
  type GetClassDetailPort,
  type GetClassDetailQuery,
  type OwnBookingSummaryDto,
} from '../port/in/get-class-detail';
import type {
  ClassDetailReader,
} from '../port/out/class-detail-reader';
import type { Clock } from '../port/out/clock';
import type { ClassSkillReader } from '../port/out/class-skill-reader';
import type { PublicTeacherReader } from '../port/out/public-teacher-reader';

const BOOKING_LEAD_TIME_MS = 24 * 60 * 60 * 1000;
const NEUTRAL_TEACHER_NAME = 'SkillSwap';

/**
 * Route 14 / FR-005, FR-006, FR-007: pure query handler for class detail.
 * CQRS read path (ADR-012: never imports domain aggregates or framework dependencies).
 * Enforces visibility, calculates seat availability and booking eligibility,
 * and surfaces own booking summary if present for the caller.
 */
export class GetClassDetailQueryHandler implements GetClassDetailPort {
  constructor(
    private readonly classDetailReader: ClassDetailReader,
    private readonly publicTeacherReader: PublicTeacherReader,
    private readonly classSkillReader: ClassSkillReader,
    private readonly clock: Clock,
  ) {}

  async execute(query: GetClassDetailQuery): Promise<ClassDetailDto> {
    const now = this.clock.now();

    const record = await this.classDetailReader.readDetail(
      query.classId,
      query.callerId,
      now,
    );

    if (!record) {
      throw new ClassDetailNotFoundError(query.classId);
    }

    // 1. Visibility rules:
    // Draft classes are strictly private to the owning teacher.
    if (record.state === 'draft' && query.callerId !== record.teacherId) {
      throw new ClassDetailNotFoundError(query.classId);
    }

    // Terminal/in-progress classes (in_progress, completed, cancelled) are visible
    // only to the teacher or callers who have an existing booking. Strangers receive 404
    // to avoid leaking unpublished class lifecycle metadata.
    if (
      record.state === 'in_progress' ||
      record.state === 'completed' ||
      record.state === 'cancelled'
    ) {
      const isTeacher = query.callerId === record.teacherId;
      const hasHistoricalBooking = record.callerBookings.length > 0;
      if (!isTeacher && !hasHistoricalBooking) {
        throw new ClassDetailNotFoundError(query.classId);
      }
    }

    // 2. Determine own booking:
    // Caller bookings are ordered by created_at DESC, id DESC.
    // The most recent booking is used as ownBooking summary.
    let ownBooking: OwnBookingSummaryDto | null = null;
    if (record.callerBookings.length > 0) {
      const latest = record.callerBookings[0];
      ownBooking = {
        bookingId: latest.id,
        state: latest.state,
        expiresAt: latest.expiresAt ? latest.expiresAt.toISOString() : null,
      };
    }

    // 3. Determine booking eligibility (canBook):
    // Can only book if:
    // - Class state is published (not draft, full, in_progress, completed, cancelled)
    // - Available seats > 0
    // - startsAt >= now + 24 hours (exact edge included)
    // - Caller is not the owning teacher
    // - Caller does not have an active booking: confirmed, completed, disputed, or unexpired pending
    const isPublished = record.state === 'published';
    const hasAvailableSeats = record.availableSeats > 0;
    const meetsLeadTime = record.startsAt.getTime() >= now.getTime() + BOOKING_LEAD_TIME_MS;
    const isNotTeacher = query.callerId !== record.teacherId;
    const hasBlockingBooking = record.callerBookings.some(
      (b) =>
        b.state === 'confirmed' ||
        b.state === 'completed' ||
        b.state === 'disputed' ||
        (b.state === 'pending' && (b.expiresAt === null || b.expiresAt.getTime() > now.getTime())),
    );

    const canBook =
      isPublished &&
      hasAvailableSeats &&
      meetsLeadTime &&
      isNotTeacher &&
      !hasBlockingBooking;

    // 4. Enrich teacher public profile display name via pure batch facade
    const teacherDisplayName = await this.resolveTeacherDisplayName(record.teacherId);
    const teacher: ClassDetailTeacherDto = {
      id: record.teacherId,
      displayName: teacherDisplayName,
      averageRating: null, // provisional until T16
      ratingsCount: 0,     // provisional until T16
    };

    // 5. Resolve the skills the class teaches. This is the join every client used to do
    //    itself (fetch the whole catalogue, match by id). A catalogue failure must not fail
    //    the page: the field is omitted and the client falls back to its "not provided" state.
    const skills = await this.resolveSkills(record.skillIds);

    return {
      id: record.id,
      teacher,
      skillIds: record.skillIds,
      ...(skills === null ? {} : { skills }),
      description: record.description,
      startsAt: record.startsAt.toISOString(),
      durationMinutes: record.durationMinutes,
      priceCredits: record.priceCredits,
      capacity: record.capacity,
      availableSeats: record.availableSeats,
      state: record.state,
      canBook,
      recentRatings: [], // provisional until T16
      ownBooking,
    };
  }

  private async resolveSkills(
    skillIds: readonly string[],
  ): Promise<ClassDetailSkillDto[] | null> {
    if (skillIds.length === 0) {
      return [];
    }
    try {
      const found = await this.classSkillReader.readMany(skillIds);
      // Report in the class's own skill order, and only skills the catalogue confirmed.
      return skillIds.flatMap((id) => {
        const skill = found.find((candidate) => candidate.id === id);
        return skill === undefined
          ? []
          : [{ id: skill.id, name: skill.name, category: skill.category, levels: [...skill.levels] }];
      });
    } catch {
      return null;
    }
  }

  private async resolveTeacherDisplayName(teacherId: string): Promise<string> {    const profiles = await this.publicTeacherReader.readMany([teacherId]);
    const profile = profiles.find((p) => p.id === teacherId);
    if (profile?.displayName && profile.displayName.trim() !== '') {
      return profile.displayName.trim();
    }
    return NEUTRAL_TEACHER_NAME;
  }
}
