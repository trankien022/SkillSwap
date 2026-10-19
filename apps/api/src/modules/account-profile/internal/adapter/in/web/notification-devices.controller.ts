import { Body, Controller, Delete, HttpCode, HttpStatus, Inject, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { deviceSubscriptionSchema, upsertDeviceSchema, type UpsertDeviceInput } from '@skillswap/contracts';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';
import { NOTIFICATION_MANAGEMENT, type NotificationManagementPort } from '../../../application/port/notification-management';

function owner(request: RequestWithIdentity): string {
  const accountId = currentUserId(request);
  if (!accountId || accountId === 'anonymous') throw new UnauthorizedException('Authentication required');
  return accountId;
}

@Controller('notification-devices')
@ApiTags('notifications')
export class NotificationDevicesController {
  constructor(@Inject(NOTIFICATION_MANAGEMENT) private readonly notifications: NotificationManagementPort) {}
  @Post()
  @ApiOperation({ summary: 'Register or rotate a push device token (Route 29)' })
  @ApiOkResponse({ description: 'Account-bound active device subscription' })
  async upsert(@Body(new ZodValidationPipe(upsertDeviceSchema)) body: UpsertDeviceInput, @Req() request: RequestWithIdentity) {
    return deviceSubscriptionSchema.parse(await this.notifications.upsertDevice(owner(request), body));
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate an owned notification device (Route 30)' })
  @ApiNoContentResponse({ description: 'Device deactivated; no body' })
  async remove(@Param('id') id: string, @Req() request: RequestWithIdentity): Promise<void> {
    await this.notifications.deleteDevice(owner(request), id);
  }
}
