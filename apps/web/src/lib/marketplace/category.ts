import type { SkillCategory } from './types';

/** Only known catalogue categories may enter the initial query from a URL. */
export function catalogueCategory(value: string | string[] | undefined): SkillCategory | undefined {
  switch (value) {
    case 'programming':
    case 'design':
    case 'language':
    case 'soft-skills':
    case 'math':
      return value;
    default:
      return undefined;
  }
}
