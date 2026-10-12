import en from './en.json';
import vi from './vi.json';

export const messages = { en, vi } as const;

export type Locale = keyof typeof messages;

export const locales: Locale[] = ['vi', 'en'];

export const defaultLocale: Locale = 'vi';

export function translator(locale: Locale) {
  const table = messages[locale] as Record<string, unknown>;
  const bookingFlat = (table.Booking ?? {}) as Record<string, string>;

  return (key: string, vars?: Record<string, string | number>): string => {
    // 1. Resolve dot notation (e.g. 'Auth.signInTitle' or 'Dashboard.greeting')
    const segments = key.split('.');
    let current: unknown = table;
    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in current) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        current = undefined;
        break;
      }
    }

    let value: string;
    if (typeof current === 'string') {
      value = current;
    } else if (bookingFlat[key]) {
      // Backward compatibility for unqualified Booking keys ('title', 'bookCta', etc.)
      value = bookingFlat[key];
    } else {
      value = key;
    }

    if (vars !== undefined) {
      for (const [name, replacement] of Object.entries(vars)) {
        value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
      }
    }
    return value;
  };
}
