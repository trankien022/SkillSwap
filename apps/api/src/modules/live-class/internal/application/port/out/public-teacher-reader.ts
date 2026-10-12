export const PUBLIC_TEACHER_READER = Symbol('PUBLIC_TEACHER_READER');

export interface PublicTeacherProfile {
  readonly id: string;
  readonly displayName: string;
}

export interface PublicTeacherReader {
  readMany(teacherIds: readonly string[]): Promise<readonly PublicTeacherProfile[]>;
}
