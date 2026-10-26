export const MARK_TEACHER_NO_SHOW = Symbol('MARK_TEACHER_NO_SHOW');

export interface MarkTeacherNoShowCommand {
  bookingId: string;
}

export interface MarkTeacherNoShowResult {
  cancelled: boolean;
}

export interface MarkTeacherNoShowPort {
  execute(command: MarkTeacherNoShowCommand): Promise<MarkTeacherNoShowResult>;
}
