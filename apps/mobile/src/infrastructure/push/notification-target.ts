import type { NotificationItem } from '@skillswap/contracts';

export type NotificationTarget = Pick<NotificationItem, 'targetType' | 'targetId'>;
export type NotificationRoute =
  | { pathname: '/(tabs)/schedule' }
  | { pathname: '/(tabs)/wallet' }
  | { pathname: '/(features)/verification' }
  | { pathname: '/(features)/notifications' }
  | { pathname: '/classes/[id]'; params: { id: string } };

/** Routes from server-loaded target identifiers; payloads never grant access. */
export function notificationRoute(targetType: unknown, targetId: unknown): NotificationRoute {
  if (targetType === 'booking') return { pathname: '/(tabs)/schedule' };
  if (targetType === 'wallet') return { pathname: '/(tabs)/wallet' };
  if (targetType === 'verification') return { pathname: '/(features)/verification' };
  if (targetType === 'class' && typeof targetId === 'string' && targetId.length > 0) {
    return { pathname: '/classes/[id]', params: { id: targetId } };
  }
  return { pathname: '/(features)/notifications' };
}

/** Wait until the session gate's Redirect has mounted an authenticated route. */
export function canOpenNotification(authenticated: boolean, loading: boolean, navigationKey: string | undefined, firstSegment: string | undefined): boolean {
  return authenticated && !loading && !!navigationKey && !!firstSegment && firstSegment !== 'index' && firstSegment !== '(auth)' && firstSegment !== 'auth';
}
