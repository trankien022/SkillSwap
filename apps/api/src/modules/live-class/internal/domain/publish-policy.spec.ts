import {
  DEFAULT_REQUIRED_LEVEL,
  isPublishable,
  levelCovers,
  NoClassSkillsError,
  SkillLevelInsufficientError,
  SkillNotApprovedError,
  UnverifiedTeacherError,
  assertPublishable,
  type TeacherTrust,
} from './publish-policy';
import {
  SKILL_LEVELS,
  assertSkillLevel,
  isSkillLevel,
  InvalidSkillLevelError,
  type SkillLevel,
} from './skill-level';

function trust(
  over: Partial<{ verified: boolean; levels: Record<string, SkillLevel | null> }> = {},
): TeacherTrust {
  return {
    verified: over.verified ?? true,
    approvedLevels: new Map(Object.entries(over.levels ?? { 'sk-1': 'advanced' })),
  };
}

describe('publish gate (FR-005 / AC-002)', () => {
  it('maps the ordered skill level scale', () => {
    expect(SKILL_LEVELS).toEqual(['beginner', 'intermediate', 'advanced', 'expert']);
    expect(isSkillLevel('advanced')).toBe(true);
    expect(isSkillLevel('master')).toBe(false);
    expect(() => assertSkillLevel('master')).toThrow(InvalidSkillLevelError);
    expect(levelCovers('expert', 'beginner')).toBe(true);
    expect(levelCovers('beginner', 'advanced')).toBe(false);
  });

  it('refuses an empty skill list', () => {
    expect(() => assertPublishable({ teacherId: 't1', teacherTrust: trust(), classSkills: [] })).toThrow(
      NoClassSkillsError,
    );
  });

  it('refuses an unverified Teacher (AC-002)', () => {
    expect(() =>
      assertPublishable({
        teacherId: 't1',
        teacherTrust: trust({ verified: false }),
        classSkills: [{ skillId: 'sk-1' }],
      }),
    ).toThrow(UnverifiedTeacherError);
  });

  it('refuses a class skill the Teacher is not approved for', () => {
    expect(() =>
      assertPublishable({
        teacherId: 't1',
        teacherTrust: trust({ levels: { 'sk-1': 'advanced' } }),
        classSkills: [{ skillId: 'sk-2' }],
      }),
    ).toThrow(SkillNotApprovedError);
  });

  it('refuses when the approved level is below the required level', () => {
    expect(() =>
      assertPublishable({
        teacherId: 't1',
        teacherTrust: trust({ levels: { 'sk-1': 'beginner' } }),
        classSkills: [{ skillId: 'sk-1', requiredLevel: 'advanced' }],
      }),
    ).toThrow(SkillLevelInsufficientError);
  });

  it('publishes when verified and approved at/above every skill level', () => {
    const input: Parameters<typeof assertPublishable>[0] = {
      teacherId: 't1',
      teacherTrust: trust({ levels: { 'sk-1': 'advanced', 'sk-2': 'expert' } }),
      classSkills: [{ skillId: 'sk-1', requiredLevel: 'intermediate' }, { skillId: 'sk-2' }],
    };
    expect(() => assertPublishable(input)).not.toThrow();
    expect(isPublishable(input)).toBe(true);
    expect(DEFAULT_REQUIRED_LEVEL).toBe('beginner');
  });

  it('fails the whole class if any single skill is unapproved (SR-BR-002)', () => {
    expect(
      isPublishable({
        teacherId: 't1',
        teacherTrust: trust({ levels: { 'sk-1': 'advanced', 'sk-2': null } }),
        classSkills: [{ skillId: 'sk-1' }, { skillId: 'sk-2' }],
      }),
    ).toBe(false);
  });
});
