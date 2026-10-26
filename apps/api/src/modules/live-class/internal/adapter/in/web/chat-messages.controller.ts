import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  DEFAULT_PAGE_LIMIT,
  chatMessagesPageSchema,
  listChatMessagesQuerySchema,
  postChatMessageSchema,
  type ChatMessagesPage,
  type ListChatMessagesQuery,
} from '@skillswap/contracts';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { decodeCursor, encodeCursor } from '../../../../../../shared/http/keyset-cursor';
import { ResponseCode, ResponseMessage } from '../../../../../../shared/http/response-code.decorator';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';
import {
  GET_CHAT_MESSAGES,
  POST_CHAT_MESSAGE,
  type GetChatMessagesPort,
  type PostChatMessagePort,
} from '../../../application/port/in/chat-messages';
import type { ChatCursorParts } from '../../../application/port/out/chat-repository';
import { ChatMessageDto, ChatMessagesPageDto } from './dto/chat-messages.dto';

/**
 * FR-012 in-class chat (ADR-036, amended).
 *
 * The cursor is decoded and encoded **here**, not in the application layer: base64 is a transport
 * detail and ADR-009 forbids the use cases from knowing it. The handler therefore works in cursor
 * *parts* and only the boundary knows they were ever a string.
 */
@Controller('classes/bookings')
@ApiTags('classes')
@ApiBearerAuth('bearer')
export class ChatMessagesController {
  constructor(
    @Inject(POST_CHAT_MESSAGE) private readonly postMessage: PostChatMessagePort,
    @Inject(GET_CHAT_MESSAGES) private readonly getMessages: GetChatMessagesPort,
  ) {}

  @Post(':bookingId/messages')
  @ResponseCode('CHAT_MESSAGE_POSTED')
  @ResponseMessage('Message posted')
  @ApiParam({ name: 'bookingId', description: 'A booking the caller is a party to' })
  @ApiOperation({
    summary: 'Post one message to a class chat (FR-012)',
    description:
      'The caller must be the booking\'s learner or its class teacher, the booking must be confirmed, and the class must be inside its room-access window. A refused send stores nothing.',
  })
  @ApiCreatedResponse({ type: ChatMessageDto, description: 'The stored message' })
  @ApiForbiddenResponse({ description: 'Caller is not a party to this booking (CHAT_NOT_A_PARTY)' })
  @ApiConflictResponse({
    description: 'Booking is not confirmed, or the window is closed (CHAT_WINDOW_CLOSED)',
  })
  async post(
    @Param('bookingId') bookingId: string,
    @Body(new ZodValidationPipe(postChatMessageSchema)) body: unknown,
    @Req() request: RequestWithIdentity,
  ): Promise<ChatMessageDto> {
    const senderId = this.requireCaller(request);
    try {
      // Only `body` is forwarded. The schema strips nothing, so spreading the raw body would
      // carry any extra field a client sent -- including `senderId` -- into the command.
      const input = postChatMessageSchema.parse(body);
      const { message } = await this.postMessage.execute({
        bookingId,
        senderId,
        input,
      });
      return message as ChatMessageDto;
    } catch (error) {
      throw this.translate(error);
    }
  }

  @Get(':bookingId/messages')
  @ResponseCode('CHAT_MESSAGES_OK')
  @ResponseMessage('Messages loaded')
  @ApiParam({ name: 'bookingId', description: 'A booking the caller is a party to' })
  @ApiOperation({
    summary: 'Read a class chat (FR-012 / NFR-014)',
    description:
      'Oldest-first, keyset-paginated. History stays readable after the class window closes; a pending booking has no conversation to read.',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size, 1–100 (default 20)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque cursor from the previous `nextCursor`' })
  @ApiOkResponse({ type: ChatMessagesPageDto, description: 'A page of messages' })
  async list(
    @Param('bookingId') bookingId: string,
    @Query(new ZodValidationPipe<unknown>(listChatMessagesQuerySchema)) query: ListChatMessagesQuery,
    @Req() request: RequestWithIdentity,
  ): Promise<ChatMessagesPage> {
    const requesterId = this.requireCaller(request);
    try {
      const result = await this.getMessages.execute({
        bookingId,
        requesterId,
        limit: query.limit ?? DEFAULT_PAGE_LIMIT,
        cursor: this.decodeChatCursor(query.cursor),
      });
      return chatMessagesPageSchema.parse({
        items: result.items,
        page: {
          limit: query.limit ?? DEFAULT_PAGE_LIMIT,
          nextCursor: result.nextCursor === null ? null : this.encodeChatCursor(result.nextCursor),
          total: result.total,
        },
      });
    } catch (error) {
      throw this.translate(error);
    }
  }

  private requireCaller(request: RequestWithIdentity): string {
    const userId = currentUserId(request);
    if (!userId || userId === 'anonymous') {
      throw new UnauthorizedException('Authentication required');
    }
    return userId;
  }

  /**
   * A cursor is an optimisation, not a contract: garbage decodes to `null` and the caller simply
   * gets the first page. Failing the request instead would turn a stale bookmark into an error
   * a user cannot fix.
   *
   * The timestamp stays a **string**. Parsing it into a `Date` here would silently drop the
   * fraction (Postgres keeps microseconds, JS keeps milliseconds) and the next page would repeat
   * the row it resumed after.
   */
  private decodeChatCursor(cursor: string | undefined): ChatCursorParts | null {
    const parts = decodeCursor(cursor);
    if (parts === null || parts.length !== 2) {
      return null;
    }
    const [createdAt, id] = parts as [string, string];
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/.test(createdAt)) {
      return null;
    }
    return { createdAt, id };
  }

  private encodeChatCursor(cursor: ChatCursorParts): string {
    return encodeCursor([cursor.createdAt, cursor.id]);
  }

  /**
   * Rethrows as-is; the filter maps the error class and attaches the stable code.
   *
   * Wrapping these in `ForbiddenException({ code }).` was the first attempt and it silently lost
   * the code: `fromHttpException` reports `HTTP_403` for any 403 and ignores a payload `code`. A
   * client then had to match English to tell "not yours" from "come back later".
   */
  private translate(error: unknown): Error {
    if (error instanceof Error) {
      return error;
    }
    return new BadRequestException('Chat request failed');
  }
}
