import { BadRequestException, Controller, Get, Inject, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  decodeSkillCursor,
  encodeSkillCursor,
  listSkillsQuerySchema,
  resolveSearchTerm,
  skillCataloguePageSchema,
  type ListSkillsQueryInput,
  type SkillCataloguePageView,
} from '@skillswap/contracts';
import {
  LIST_SKILLS,
  type ListSkillsPort,
} from '../../../application/port/in/list-skills';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';
import { SkillCataloguePageDto } from './dto/skill-catalogue.dto';

@Controller('skills')
@ApiTags('skill-verification')
@ApiBearerAuth('bearer')
export class SkillsController {
  constructor(
    @Inject(LIST_SKILLS) private readonly listSkills: ListSkillsPort,
  ) {}

  @Get()
  @ResponseCode('SKILLS_LIST_OK')
  @ResponseMessage('Skills loaded')
  @ApiOperation({
    summary: 'List available skills catalogue (mobile / T12)',
    description:
      'Keyset-paginated (`limit` 1–100, default 50; opaque `cursor` ordered by category, name, id). Free-text search is `q`; `keyword` is accepted as a deprecated alias for one release.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search over skill name and category (canonical search parameter)' })
  @ApiQuery({ name: 'keyword', required: false, deprecated: true, description: 'Deprecated alias for `q`; removed after one release' })
  @ApiQuery({ name: 'category', required: false, description: 'Only skills in this category' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size, 1–100 (default 50)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque cursor from the previous `nextCursor`' })
  @ApiOkResponse({ type: SkillCataloguePageDto, description: 'Paginated list of available skills with allowed proficiency levels' })
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
      keyword: resolveSearchTerm(query),
      limit: query.limit,
      cursor: cursorTuple,
    });

    return skillCataloguePageSchema.parse({
      items: page.items,
      nextCursor: page.nextCursor ? encodeSkillCursor(page.nextCursor) : null,
    });
  }
}
