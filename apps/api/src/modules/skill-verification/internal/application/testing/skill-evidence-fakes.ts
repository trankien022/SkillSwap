import {
  ProfileSkill,
  SkillEvidence,
  type Skill,
  type SkillLevel,
} from '../../domain/evidence';
import type { Clock } from '../port/out/clock';
import type { SkillRepository } from '../port/out/skill-repository';
import type {
  CreateSkillEvidenceRequest,
  ProfileSkillRepository,
  SkillEvidenceRepository,
} from '../port/out/skill-evidence-repository';
import type { VerifiedStudentReader } from '../port/out/verified-student-reader';

export function fixedClock(now: Date): Clock {
  return { now: () => now };
}

/** In-memory catalogue for use-case specs. */
export class InMemorySkillRepository implements SkillRepository {
  constructor(private readonly skills: Skill[] = []) {}

  async findActiveById(skillId: string): Promise<Skill | null> {
    return this.skills.find((skill) => skill.id === skillId && skill.active) ?? null;
  }
}

/** In-memory ProfileSkillRepository; ids are assigned incrementally. */
export class InMemoryProfileSkillRepository implements ProfileSkillRepository {
  readonly rows: ProfileSkill[] = [];
  private seq = 0;

  async findByAccountAndSkill(accountId: string, skillId: string): Promise<ProfileSkill | null> {
    return (
      this.rows.find((row) => row.accountId === accountId && row.skillId === skillId) ?? null
    );
  }

  async findOrCreate(accountId: string, skillId: string): Promise<ProfileSkill> {
    const existing = await this.findByAccountAndSkill(accountId, skillId);
    if (existing !== null) {
      return existing;
    }
    const link = ProfileSkill.create({
      id: `ps-${++this.seq}`,
      accountId,
      skillId,
      createdAt: new Date('2026-10-11T00:00:00.000Z'),
    });
    this.rows.push(link);
    return link;
  }
}

/** In-memory SkillEvidenceRepository; assigns versions per profile-skill. */
export class InMemorySkillEvidenceRepository implements SkillEvidenceRepository {
  readonly rows: SkillEvidence[] = [];

  async nextVersion(profileSkillId: string): Promise<number> {
    const versions = this.rows
      .filter((row) => row.profileSkillId === profileSkillId)
      .map((row) => row.version);
    return versions.length === 0 ? 1 : Math.max(...versions) + 1;
  }

  async create(request: CreateSkillEvidenceRequest): Promise<SkillEvidence> {
    const evidence = SkillEvidence.submit({
      id: request.id,
      profileSkillId: request.profileSkillId,
      evidenceType: request.evidenceType,
      documentRef: request.documentRef,
      description: request.description,
      version: await this.nextVersion(request.profileSkillId),
      requestedLevel: request.requestedLevel,
      submittedAt: request.submittedAt,
    });
    this.rows.push(evidence);
    return evidence;
  }

  async listByProfileSkill(profileSkillId: string): Promise<SkillEvidence[]> {
    return this.rows
      .filter((row) => row.profileSkillId === profileSkillId)
      .sort((a, b) => b.version - a.version);
  }
}

/** In-memory VerifiedStudentReader keyed by account id. */
export class InMemoryVerifiedStudentReader implements VerifiedStudentReader {
  constructor(private readonly verified: ReadonlySet<string> = new Set()) {}

  async isVerifiedStudent(accountId: string): Promise<boolean> {
    return this.verified.has(accountId);
  }
}

export function skillFixture(over: Partial<Skill> = {}): Skill {
  return { id: 'sk-1', name: 'IELTS', category: 'Languages', active: true, ...over };
}

export const LEVEL: SkillLevel = 'intermediate';
