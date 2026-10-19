import { createZodDto } from 'nestjs-zod';
import { skillCataloguePageSchema } from '@skillswap/contracts';

/** Route 09 / FR-003: a page of the managed skill catalogue. */
export class SkillCataloguePageDto extends createZodDto(skillCataloguePageSchema) {}
