import type { ClassRosterView } from '@skillswap/contracts';

export const GET_CLASS_ROSTER = Symbol('GET_CLASS_ROSTER');

export interface GetClassRosterQuery {
  classId: string;
  /** The authenticated caller. The roster is teacher-only; anyone else receives not-found. */
  callerId: string;
}

export interface GetClassRosterPort {
  execute(query: GetClassRosterQuery): Promise<ClassRosterView>;
}
