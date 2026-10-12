import type { PublicProfileReader } from '../../../../../account-profile/api';
import type {
  PublicTeacherProfile,
  PublicTeacherReader,
} from '../../../application/port/out/public-teacher-reader';

/**
 * Outbound adapter delegating bulk teacher profile reads to the AccountProfileModule's public facade.
 * Conforms to module isolation rules (only imports account-profile/api, never its internals or cross-schema SQL).
 */
export class AccountProfilePublicTeacherReader implements PublicTeacherReader {
  constructor(private readonly reader: PublicProfileReader) {}

  async readMany(teacherIds: readonly string[]): Promise<readonly PublicTeacherProfile[]> {
    if (teacherIds.length === 0) {
      return [];
    }
    const profiles = await this.reader.readMany(teacherIds);
    return profiles.map((p) => ({
      id: p.id,
      displayName: p.displayName,
    }));
  }
}
