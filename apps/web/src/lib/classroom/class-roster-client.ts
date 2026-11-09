import { classRosterSchema, type ClassRosterView } from '@skillswap/contracts';
import { ApiResponseError, callApi, unwrapEnvelope } from '../api-client';

/**
 * FR-011 / ADR-040: the teacher's roster for their own class.
 *
 * Returns `null` rather than throwing when the server answers 404: that is the response for
 * "you are not this class's teacher", which is an ordinary state on a shared URL, not an
 * exceptional one. Anything else propagates, so a genuine failure never looks like an empty
 * class.
 */
export async function fetchClassRoster(classId: string): Promise<ClassRosterView | null> {
  const res = await callApi(`/classes/${encodeURIComponent(classId)}/roster`, { method: 'GET' });

  try {
    const data = await unwrapEnvelope<ClassRosterView>(res);
    return classRosterSchema.parse(data);
  } catch (error) {
    if (error instanceof ApiResponseError && res.status === 404) {
      return null;
    }
    throw error;
  }
}
