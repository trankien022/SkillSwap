import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { NotificationsPage } from '@skillswap/contracts';
import type { RequestWithIdentity } from '../../../../../../shared/http/identity';
import type { NotificationManagementPort } from '../../../application/port/notification-management';
import { NotificationsController } from './notifications.controller';

function request(accountId: string | null, acceptLanguage?: string): RequestWithIdentity {
  return {
    user: accountId ? { id: accountId } : undefined,
    headers: acceptLanguage === undefined ? {} : { 'accept-language': acceptLanguage },
  } as unknown as RequestWithIdentity;
}

const emptyPage: NotificationsPage = { items: [], nextCursor: null, unreadCount: 0 };

function controller(overrides: Partial<NotificationManagementPort> = {}) {
  const port: NotificationManagementPort = {
    list: jest.fn().mockResolvedValue(emptyPage),
    upsertDevice: jest.fn(),
    deleteDevice: jest.fn(),
    recordInboxNotification: jest.fn(),
    markRead: jest.fn().mockResolvedValue(0),
    markAllRead: jest.fn().mockResolvedValue(0),
    ...overrides,
  };
  return { port, subject: new NotificationsController(port) };
}

describe('NotificationsController (B6 read state)', () => {
  it('marks one notification read and answers with the remaining unread count', async () => {
    const { port, subject } = controller({ markRead: jest.fn().mockResolvedValue(2) });

    await expect(subject.markRead('n1', request('account-a'))).resolves.toEqual({
      success: true,
      unreadCount: 2,
    });
    // Owner is taken from the token, never from the body or the path.
    expect(port.markRead).toHaveBeenCalledWith('account-a', 'n1');
  });

  it('answers 404 for a notification the caller does not own', async () => {
    const { subject } = controller({ markRead: jest.fn().mockResolvedValue(null) });

    await expect(subject.markRead('someone-elses-id', request('account-a'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('marks the whole inbox read and answers unreadCount 0', async () => {
    const { port, subject } = controller({ markAllRead: jest.fn().mockResolvedValue(0) });

    await expect(subject.markAllRead(request('account-a'))).resolves.toEqual({
      success: true,
      unreadCount: 0,
    });
    expect(port.markAllRead).toHaveBeenCalledWith('account-a');
  });

  it('refuses both writes without an authenticated caller', async () => {
    const { port, subject } = controller();

    await expect(subject.markRead('n1', request(null))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(subject.markAllRead(request(null))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(port.markRead).not.toHaveBeenCalled();
    expect(port.markAllRead).not.toHaveBeenCalled();
  });

  /**
   * The second place a bare parameterised route could shadow a literal one (`POST :id/read` versus
   * `POST read-all`). Nest builds the routing table in declaration order, so the literal must come
   * first. This reads the real path metadata Nest uses off the prototype, so the guard fails if
   * either handler moves or its path changes.
   */
  it('declares the literal read-all route before the parameterised one', () => {
    const PATH_METADATA = 'path';
    const getPath = (handler: unknown): string | undefined =>
      Reflect.getMetadata(PATH_METADATA, handler as object) as string | undefined;

    expect(getPath(NotificationsController.prototype.markAllRead)).toBe('read-all');
    expect(getPath(NotificationsController.prototype.markRead)).toBe(':id/read');

    const declarationOrder = Object.getOwnPropertyNames(NotificationsController.prototype);
    expect(declarationOrder.indexOf('markAllRead')).toBeGreaterThan(-1);
    expect(declarationOrder.indexOf('markAllRead')).toBeLessThan(
      declarationOrder.indexOf('markRead'),
    );
  });
});

describe('NotificationsController language negotiation (defect #3)', () => {
  it('passes the caller’s Accept-Language through to the read', async () => {
    const { port, subject } = controller();

    await subject.list({ limit: 20 }, request('account-a', 'en-GB,en;q=0.9'));

    // Fourth argument: the resolved language, not the raw header.
    expect(port.list).toHaveBeenCalledWith('account-a', { limit: 20 }, undefined, 'en');
  });

  it('passes undefined when the caller states no supported language', async () => {
    const { port, subject } = controller();

    await subject.list({ limit: 20 }, request('account-a', 'fr-FR'));
    expect(port.list).toHaveBeenCalledWith('account-a', { limit: 20 }, undefined, undefined);

    (port.list as jest.Mock).mockClear();
    await subject.list({ limit: 20 }, request('account-a'));
    expect(port.list).toHaveBeenCalledWith('account-a', { limit: 20 }, undefined, undefined);
  });

  it('still resolves the owner from the token, not the header', async () => {
    const { port, subject } = controller();

    await expect(subject.list({ limit: 20 }, request(null, 'en'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(port.list).not.toHaveBeenCalled();
  });
});
