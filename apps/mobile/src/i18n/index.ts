import en from './en.json';
import vi from './vi.json';

export const messages = { en, vi } as const;

export type Locale = keyof typeof messages;

export const locales: Locale[] = ['en', 'vi'];

export const defaultLocale: Locale = 'en';

export function translator(locale: Locale) {
  const table = messages[locale];
  const flat = (table as { Booking: Record<string, string> }).Booking;
  return (key: string, vars?: Record<string, string | number>): string => {
    let value = flat[key] ?? key;
    if (vars !== undefined) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.replace(`{${name}}`, String(replacement));
      }
    }
    return value;
  };
}
