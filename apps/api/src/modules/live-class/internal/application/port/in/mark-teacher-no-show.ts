export const MARK_TEACHER_NO_SHOW = Symbol('MARK_TEACHER_NO_SHOW');

export interface MarkTeacherNoShowCommand {
  bookingId: string;
  /** When the Teacher was seen joining the room, or null if never. */
  teacherJoinedAt: Date | null;
}

export interface MarkTeacherNoShowResult {
  cancelled: boolean;
}

export interface MarkTeacherNoShowPort {
  execute(command: MarkTeacherNoShowCommand): Promise<MarkTeacherNoShowResult>;
}
