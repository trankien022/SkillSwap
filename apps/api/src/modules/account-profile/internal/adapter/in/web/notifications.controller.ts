import { BadRequestException, Controller, Get, Inject, Query, Req, UnauthorizedException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { listNotificationsQuerySchema, notificationsPageSchema, type NotificationsPage } from '@skillswap/contracts';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';
import { NOTIFICATION_MANAGEMENT, type NotificationManagementPort } from '../../../application/port/notification-management';

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
export class NotificationsController {
  constructor(@Inject(NOTIFICATION_MANAGEMENT) private readonly notifications: NotificationManagementPort) {}
  @Get()
  @ApiOperation({ summary: 'List the signed-in user notification inbox (FR-016 / Route 28)' })
  @ApiOkResponse({ description: 'Owner-scoped notifications, cursor and exact unread count' })
  async list(@Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ReturnType<typeof listNotificationsQuerySchema.parse>, @Req() request: RequestWithIdentity): Promise<NotificationsPage> {
    const accountId = currentUserId(request);
    if (!accountId || accountId === 'anonymous') throw new UnauthorizedException('Authentication required');
    return notificationsPageSchema.parse(await this.notifications.list(accountId, query, decodeCursor(query.cursor)));
  }
}
