import { BadRequestException, Controller, Get, Inject, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  decodeSkillCursor,
  encodeSkillCursor,
  listSkillsQuerySchema,
  skillCataloguePageSchema,
  type ListSkillsQueryInput,
  type SkillCataloguePageView,
} from '@skillswap/contracts';
import {
  LIST_SKILLS,
  type ListSkillsPort,
} from '../../../application/port/in/list-skills';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

@Controller('skills')
@ApiTags('skill-verification')
export class SkillsController {
  constructor(
    @Inject(LIST_SKILLS) private readonly listSkills: ListSkillsPort,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List available skills catalogue (mobile / T12)' })
  @ApiOkResponse({ description: 'Paginated list of available skills with allowed proficiency levels' })
  async list(
    @Query(new ZodValidationPipe(listSkillsQuerySchema)) query: ListSkillsQueryInput,
    @Req() request: RequestWithIdentity,
  ): Promise<SkillCataloguePageView> {
    const userId = currentUserId(request);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException('Authentication required');
    }

    let cursorTuple: [string, string, string] | undefined;
    if (query.cursor) {
      try {
        cursorTuple = decodeSkillCursor(query.cursor);
      } catch {
        throw new BadRequestException('Malformed skill cursor');
      }
    }

    const page = await this.listSkills.execute({
      category: query.category,
      keyword: query.keyword,
      limit: query.limit,
      cursor: cursorTuple,
    });

    return skillCataloguePageSchema.parse({
      items: page.items,
      nextCursor: page.nextCursor ? encodeSkillCursor(page.nextCursor) : null,
    });
  }
}
