import { Controller, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type {
  OutboxDeadLetterPage,
  OutboxDeadLetterQueryInput,
  ReplayDeadLetterResultView,
} from '@skillswap/contracts';
import {
  LIST_OUTBOX_DEAD_LETTERS,
  REPLAY_OUTBOX_DEAD_LETTER,
  type ListOutboxDeadLettersPort,
  type ReplayOutboxDeadLetterPort,
} from '../../../application/port/in/outbox-dead-letters';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  decodeCursor,
  encodeCursor,
} from '../../../../../../shared/http/keyset-cursor';
import { InvalidCursorError } from '../../../../../../shared/errors';
import { Roles } from '../../../../../../shared/http/roles.decorator';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import {
  OutboxDeadLetterPageDto,
  OutboxDeadLetterQueryDto,
  ReplayDeadLetterQueryDto,
  ReplayDeadLetterResultDto,
} from './dto/outbox-dead-letter.dto';

/**
 * Decodes the page cursor, which is an offset rather than a keyset key.
 *
 * Dead letters span seven schemas that cannot be joined (ADR-014), so their global ordering is
 * established by merging in the application; an offset is the one cursor that survives that
 * merge. A malformed cursor is a client error, not an empty page.
 */
function decodeOffset(cursor: string | undefined): number {
  const decoded = decodeCursor(cursor);
  if (decoded === null) {
    return 0;
  }
  if (decoded.length !== 1) {
    throw new InvalidCursorError();
  }
  const offset = Number(decoded[0]);
  if (!Number.isInteger(offset) || offset < 0) {
    throw new InvalidCursorError();
  }
  return offset;
}

/**
 * FR-015 / ADR-013 Amendment A (W2 C3, decided 2026-10-25): the outbox dead-letter inbox.
 *
 * `admin`-only, like the audit log: a dead letter carries an event body, so it is not
 * something a module owner or a learner may read. The module rides as a query parameter
 * (collection) and as a body field (replay) because an id alone is not unique across the
 * seven schemas (ADR-014).
 */
@Controller('operations/outbox-dead-letters')
@ApiTags('admin-operation')
@ApiBearerAuth('bearer')
export class OutboxDeadLetterController {
  constructor(
    @Inject(LIST_OUTBOX_DEAD_LETTERS)
    private readonly listDeadLetters: ListOutboxDeadLettersPort,
    @Inject(REPLAY_OUTBOX_DEAD_LETTER)
    private readonly replayDeadLetter: ReplayOutboxDeadLetterPort,
  ) {}

  @Get()
  @Roles('admin')
  @ResponseCode('OUTBOX_DEAD_LETTERS_OK')
  @ResponseMessage('Dead letters loaded')
  @ApiOperation({
    summary: 'Outbox rows the relay proved it cannot publish (FR-015 / ADR-013 Amendment A)',
  })
  @ApiOkResponse({ type: OutboxDeadLetterPageDto, description: 'Dead letters, newest first' })
  list(@Query() query: OutboxDeadLetterQueryDto): Promise<OutboxDeadLetterPage> {
    const input: OutboxDeadLetterQueryInput = {
      limit: query.limit,
      cursor: query.cursor,
      module: query.module,
      eventType: query.eventType,
    };
    const offset = decodeOffset(query.cursor);
    return this.listDeadLetters.execute(input, offset).then((page) => ({
      items: page.items,
      page: {
        ...page.page,
        // An offset cursor, because the ordering spans seven schemas that cannot be joined
        // (ADR-014); it is encoded with the shared helper so the format stays opaque.
        nextCursor: page.hasMore ? encodeCursor([offset + page.items.length]) : null,
      },
    }));
  }

  @Post(':id/replay')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @ResponseCode('OUTBOX_DEAD_LETTER_REPLAYED')
  @ResponseMessage('Dead letter replayed')
  @ApiParam({ name: 'id', description: 'The outbox row id' })
  @ApiOperation({ summary: 'Reset one dead letter to PENDING and audit the action (W2 C3)' })
  @ApiOkResponse({ type: ReplayDeadLetterResultDto, description: 'Whether and how the row moved' })
  replay(
    @Param('id') id: string,
    @Query() query: ReplayDeadLetterQueryDto,
    @Req() request: RequestWithIdentity,
  ): Promise<ReplayDeadLetterResultView> {
    return this.replayDeadLetter.execute({ module: query.module, id }, currentUserId(request));
  }
}
