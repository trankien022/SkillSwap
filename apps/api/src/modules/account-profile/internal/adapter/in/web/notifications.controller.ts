import { BadRequestException, Controller, Get, Inject, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { listNotificationsQuerySchema, notificationsPageSchema, type NotificationsPage } from '@skillswap/contracts';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';
import { NOTIFICATION_MANAGEMENT, type NotificationManagementPort } from '../../../application/port/notification-management';
import { NotificationsPageDto } from './dto/notifications.dto';

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
  async list(@Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ReturnType<typeof listNotificationsQuerySchema.parse>, @Req() request: RequestWithIdentity): Promise<NotificationsPage> {
    const accountId = currentUserId(request);
    if (!accountId || accountId === 'anonymous') throw new UnauthorizedException('Authentication required');
    return notificationsPageSchema.parse(await this.notifications.list(accountId, query, decodeCursor(query.cursor)));
  }
}
