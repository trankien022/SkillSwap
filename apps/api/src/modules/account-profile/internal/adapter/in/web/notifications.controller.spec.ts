import { UnauthorizedException } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationDevicesController } from './notification-devices.controller';

describe('Notification controllers', () => {
  const anonymous = { headers: {} } as never;
  it('requires a signed-in owner for inbox and device operations', async () => {
    const service = { list: jest.fn(), upsertDevice: jest.fn(), deleteDevice: jest.fn(), recordInboxNotification: jest.fn() };
    const inbox = new NotificationsController(service);
    const devices = new NotificationDevicesController(service);
    await expect(inbox.list({ limit: 20 }, anonymous)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(devices.upsert({ token: 'token', platform: 'ios', installationId: 'install' }, anonymous)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(devices.remove('device-1', anonymous)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(service.list).not.toHaveBeenCalled();
    expect(service.upsertDevice).not.toHaveBeenCalled();
    expect(service.deleteDevice).not.toHaveBeenCalled();
  });
});
