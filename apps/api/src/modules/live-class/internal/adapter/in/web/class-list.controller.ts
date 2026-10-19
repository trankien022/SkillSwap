import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  decodeClassCursor,
  encodeClassCursor,
  listClassesPageSchema,
  listClassesQuerySchema,
  resolveSearchTerm,
  type ListClassesQueryInput,
  type ListClassesPageView,
} from '@skillswap/contracts';
import {
  LIST_CLASSES,
  type ListClassesPort,
} from '../../../application/port/in/list-classes';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';
import { ClassListPageDto } from './dto/class-read.dto';

@Controller('classes')
@ApiTags('classes')
@ApiBearerAuth('bearer')
export class ClassListController {
  constructor(
    @Inject(LIST_CLASSES) private readonly listClasses: ListClassesPort,
  ) {}

  @Get()
  @ResponseCode('CLASSES_LIST_OK')
  @ResponseMessage('Classes loaded')
  @ApiOperation({
    summary: 'List classes for marketplace or own teaching (FR-005, FR-006 / Route 13)',
    description:
      'Keyset-paginated (`limit` 1–100, default 20; opaque `cursor`). Free-text search is `q`; `keyword` is accepted as a deprecated alias for one release. `teacherId=me` switches to the caller own classes and adds `totalActiveTeachingCount`.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search over the class description (canonical search parameter)' })
  @ApiQuery({ name: 'keyword', required: false, deprecated: true, description: 'Deprecated alias for `q`; removed after one release' })
  @ApiQuery({ name: 'skillId', required: false, description: 'Only classes teaching this skill id' })
  @ApiQuery({ name: 'startDate', required: false, description: 'ISO-8601 lower bound on `startsAt`' })
  @ApiQuery({ name: 'endDate', required: false, description: 'ISO-8601 upper bound on `startsAt`' })
  @ApiQuery({ name: 'teacherId', required: false, description: 'A teacher id, or `me` for the caller own classes' })
  @ApiQuery({ name: 'state', required: false, description: 'Lifecycle state of the class' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size, 1–100 (default 20)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque cursor from the previous `nextCursor`' })
  @ApiOkResponse({ type: ClassListPageDto, description: 'Paginated classes list with keyset cursor and optional active count' })
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
      keyword: resolveSearchTerm(query),
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
