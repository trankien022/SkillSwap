import type { NotificationItem } from '@skillswap/contracts';

type Translate = (key: string) => string;

/** Server copy (B7) first; the client map only fills a blank, and a missing key never reaches the user. */
function copyOrFallback(serverText: string, fallbackKey: string, t: Translate): string {
  if (serverText.trim()) return serverText;
  const fallback = t(fallbackKey);
  return fallback === fallbackKey ? '' : fallback;
}

export function notificationCopy(
  item: Pick<NotificationItem, 'type' | 'title' | 'body'>,
  t: Translate,
): { title: string; body: string } {
  return {
    title: copyOrFallback(item.title, `Notifications.type_${item.type}`, t) || t('Notifications.title'),
    body: copyOrFallback(item.body, `Notifications.body_${item.type}`, t),
  };
}
