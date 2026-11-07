import { BadRequestException, Controller, Get, Inject, NotFoundException, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  listNotificationsQuerySchema,
  markNotificationsReadResponseSchema,
  notificationsPageSchema,
  type ListNotificationsQuery,
  type MarkNotificationsReadResponse,
  type NotificationsPage,
} from '@skillswap/contracts';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';
import { NOTIFICATION_MANAGEMENT, type NotificationManagementPort } from '../../../application/port/notification-management';
import { MarkNotificationsReadDto, NotificationsPageDto } from './dto/notifications.dto';

function decodeCursor(cursor: string | undefined): readonly [Date, string] | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const separator = decoded.indexOf('|');
    const date = new Date(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    if (separator < 1 || !id || Number.isNaN(date.getTime())) throw new Error('bad cursor');
    return [date, id];
  } catch { throw new BadRequestException('Malformed notification cursor'); }
}

function owner(request: RequestWithIdentity): string {
  const accountId = currentUserId(request);
  if (!accountId || accountId === 'anonymous') throw new UnauthorizedException('Authentication required');
  return accountId;
}

@Controller('notifications')
@ApiTags('notifications')
@ApiBearerAuth('bearer')
export class NotificationsController {
  constructor(@Inject(NOTIFICATION_MANAGEMENT) private readonly notifications: NotificationManagementPort) {}

  @Get()
  @ResponseCode('NOTIFICATIONS_LIST_OK')
  @ResponseMessage('Notifications loaded')
  @ApiOperation({
    summary: 'List the signed-in user notification inbox (FR-016 / Route 28)',
    description:
      'Owner-scoped and keyset-paginated (`limit` 1–100, default 20; opaque `cursor`). `unreadCount` counts the whole inbox, not just the current page.',
  })
  @ApiQuery({ name: 'unreadOnly', required: false, description: 'When `true`, only unread notifications are returned' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size, 1–100 (default 20)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Opaque cursor from the previous `nextCursor`' })
  @ApiOkResponse({ type: NotificationsPageDto, description: 'Owner-scoped notifications, cursor and exact unread count' })
  async list(@Query(new ZodValidationPipe<unknown>(listNotificationsQuerySchema)) query: ListNotificationsQuery, @Req() request: RequestWithIdentity): Promise<NotificationsPage> {
    return notificationsPageSchema.parse(await this.notifications.list(owner(request), query, decodeCursor(query.cursor)));
  }

  /**
   * B6: declared **before** the parameterised `:id/read` route. Nest matches in declaration order,
   * so keeping the literal first means no future bare or shorter `:id` route can swallow
   * `POST /notifications/read-all` — the same hazard the student-verification controller documents
   * for `GET /student-verifications/me`. A test pins the order.
   */
  @Post('read-all')
  @ResponseCode('NOTIFICATIONS_MARKED_READ')
  @ResponseMessage('Notifications marked read')
  @ApiOperation({
    summary: "Mark the caller's whole inbox as read (FR-016)",
    description: 'Owner-scoped. Answers with the remaining unread count, which is 0 by construction.',
  })
  @ApiOkResponse({ type: MarkNotificationsReadDto, description: 'Inbox cleared; unread count 0' })
  async markAllRead(@Req() request: RequestWithIdentity): Promise<MarkNotificationsReadResponse> {
    const unreadCount = await this.notifications.markAllRead(owner(request));
    return markNotificationsReadResponseSchema.parse({ success: true, unreadCount });
  }

  @Post(':id/read')
  @ResponseCode('NOTIFICATIONS_MARKED_READ')
  @ResponseMessage('Notification marked read')
  @ApiParam({ name: 'id', description: 'The inbox notification id' })
  @ApiOperation({
    summary: 'Mark one owned notification as read (FR-016)',
    description:
      'Idempotent: marking an already-read row succeeds and leaves the count unchanged. An id the caller does not own answers 404, so the route never confirms that somebody else\'s notification exists.',
  })
  @ApiOkResponse({ type: MarkNotificationsReadDto, description: 'Remaining unread count for the caller' })
  @ApiNotFoundResponse({ description: 'No such notification belongs to the caller (HTTP_404)' })
  async markRead(@Param('id') id: string, @Req() request: RequestWithIdentity): Promise<MarkNotificationsReadResponse> {
    const unreadCount = await this.notifications.markRead(owner(request), id);
    if (unreadCount === null) throw new NotFoundException('Notification not found');
    return markNotificationsReadResponseSchema.parse({ success: true, unreadCount });
  }
}
