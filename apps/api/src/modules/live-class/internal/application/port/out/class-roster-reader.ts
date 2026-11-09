export const CLASS_ROSTER_READER = Symbol('CLASS_ROSTER_READER');

/** FR-011 / ADR-040: a seat on a class, as the teacher sees it. */
export interface ClassRosterEntry {
  readonly bookingId: string;
  readonly learnerId: string;
  readonly state: 'pending' | 'confirmed';
  readonly createdAt: Date;
}

export interface ClassRosterReader {
  /**
   * Active seats for a class. "Active" is `pending` with an unexpired hold plus `confirmed`;
   * a cancelled or expired seat must not look enrolled to the teacher.
   */
  findActiveSeats(criteria: { classId: string; now: Date }): Promise<readonly ClassRosterEntry[]>;
}
