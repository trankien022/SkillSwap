/**
 * FR-005 / ADR-026: the fixed ordered skill level scale, owned locally by `live-class`.
 *
 * This mirrors the skill-verification catalogue's scale (ADR-026) but is declared here
 * because modules must not reach into each other (ADR-014); the values are the shared
 * contract (`skillLevelSchema`). Ordered, so the publish gate can compare levels.
 */

export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_LEVEL_ORDER: Readonly<Record<SkillLevel, number>> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

export function isSkillLevel(value: string): value is SkillLevel {
  return (SKILL_LEVELS as readonly string[]).includes(value);
}

export function assertSkillLevel(value: string): asserts value is SkillLevel {
  if (!isSkillLevel(value)) {
    throw new InvalidSkillLevelError(value);
  }
}

export class InvalidSkillLevelError extends Error {
  constructor(level: string) {
    super(`Invalid skill level: ${level}`);
    this.name = 'InvalidSkillLevelError';
  }
}
