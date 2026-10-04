import { getRequestConfig } from 'next-intl/server';
import { routing, type Locale } from './routing';

function resolveLocale(value: string | undefined): Locale {
  if (value && (routing.locales as readonly string[]).includes(value)) {
    return value as Locale;
  }
  return routing.defaultLocale;
}

const messageLoaders: Record<Locale, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('../messages/en.json'),
  vi: () => import('../messages/vi.json'),
};

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = resolveLocale(await requestLocale);
  const { default: messages } = await messageLoaders[locale]();
  return { locale, messages };
});
