import type { SkillCatalogueSummaryReader } from '../../../../../skill-verification/api';
import type {
  ClassSkill,
  ClassSkillReader,
} from '../../../application/port/out/class-skill-reader';

/**
 * Outbound adapter delegating class-skill lookups to the SkillVerificationModule's public
 * facade. Conforms to module isolation rules: imports only `skill-verification/api`, never
 * its internals, and issues no cross-schema SQL (ADR-014).
 */
export class SkillVerificationClassSkillReader implements ClassSkillReader {
  constructor(private readonly reader: SkillCatalogueSummaryReader) {}

  async readMany(skillIds: readonly string[]): Promise<readonly ClassSkill[]> {
    if (skillIds.length === 0) {
      return [];
    }
    return this.reader.readMany(skillIds);
  }
}
