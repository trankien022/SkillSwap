import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  decodeClassCursor,
  encodeClassCursor,
  listClassesPageSchema,
  listClassesQuerySchema,
  type ListClassesQueryInput,
  type ListClassesPageView,
} from '@skillswap/contracts';
import {
  LIST_CLASSES,
  type ListClassesPort,
} from '../../../application/port/in/list-classes';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

@Controller('classes')
@ApiTags('classes')
export class ClassListController {
  constructor(
    @Inject(LIST_CLASSES) private readonly listClasses: ListClassesPort,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List classes for marketplace or own teaching (FR-005, FR-006 / Route 13)' })
  @ApiOkResponse({ description: 'Paginated classes list with keyset cursor and optional active count' })
  async list(
    @Query(new ZodValidationPipe(listClassesQuerySchema)) query: ListClassesQueryInput,
    @Req() request: RequestWithIdentity,
  ): Promise<ListClassesPageView> {
    const userId = currentUserId(request);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException('Authentication required');
    }

    let cursorTuple: [string, string] | undefined;
    if (query.cursor) {
      try {
        cursorTuple = decodeClassCursor(query.cursor);
      } catch {
        throw new BadRequestException('Malformed class cursor');
      }
    }

    const page = await this.listClasses.execute({
      callerId: userId,
      keyword: query.keyword,
      skillId: query.skillId,
      startDate: query.startDate,
      endDate: query.endDate,
      teacherId: query.teacherId,
      state: query.state,
      limit: query.limit,
      cursor: cursorTuple,
    });

    return listClassesPageSchema.parse({
      items: page.items,
      nextCursor: page.nextCursor ? encodeClassCursor(page.nextCursor) : null,
      ...(page.totalActiveTeachingCount !== undefined
        ? { totalActiveTeachingCount: page.totalActiveTeachingCount }
        : {}),
    });
  }
}
