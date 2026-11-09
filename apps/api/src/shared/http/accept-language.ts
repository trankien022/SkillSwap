/**
 * The language a request asks to be answered in.
 *
 * Content negotiation is the standard way to say "render this for me": the caller
 * states a preference, and the server either honours it or falls back. The tags are
 * langtag-shaped, so a caller may send `vi`, `vi-VN`, `en-GB` or a priority list
 * with quality values, and a generic `*` is permitted too.
 *
 * Only the two languages the product actually carries are recognised. Anything else
 * returns `undefined` rather than the first tag, because guessing at an unsupported
 * language would be a worse answer than falling back deliberately.
 */

/** The languages the notification catalogue carries. */
export type SupportedLocale = 'vi' | 'en';

const SUPPORTED: readonly SupportedLocale[] = ['vi', 'en'];

/**
 * A quality value from an `Accept-Language` entry.
 *
 * `q=0` means "explicitly not acceptable", so it is honoured as a rejection rather
 * than treated as an absent preference — the RFC's meaning, and the one caller who
 * bothers to send `q=0` means it.
 */
interface Preference {
  primary: string;
  quality: number;
  order: number;
}

function parsePreferences(header: string): Preference[] {
  return header
    .split(',')
    .map((entry, order) => {
      const [rawTag, ...params] = entry.split(';');
      const tag = (rawTag ?? '').trim().toLowerCase();
      if (tag.length === 0) return undefined;
      const qParam = params.find((p) => p.trim().toLowerCase().startsWith('q='));
      const quality = qParam === undefined ? 1 : Number.parseFloat(qParam.split('=')[1] ?? '1');
      return {
        // Region is irrelevant here: `en-GB` and `en-US` both resolve to the same copy.
        primary: tag.split('-')[0] ?? tag,
        quality: Number.isFinite(quality) ? quality : 1,
        order,
      };
    })
    .filter((preference): preference is Preference => preference !== undefined);
}

/**
 * Picks the caller's preferred language, or `undefined` when they express no
 * usable preference.
 *
 * Highest quality wins; equal qualities keep the order the caller wrote them in, so
 * `vi-VN,en;q=0.5` and `en;q=0.5,vi-VN` do not resolve to the same language by
 * accident of iteration.
 */
export function localeFromAcceptLanguage(
  header: string | undefined,
): SupportedLocale | undefined {
  if (header === undefined) return undefined;
  const preferences = parsePreferences(header).sort(
    (a, b) => b.quality - a.quality || a.order - b.order,
  );
  for (const preference of preferences) {
    if (preference.quality <= 0) continue;
    const match = SUPPORTED.find((locale) => locale === preference.primary);
    if (match !== undefined) return match;
  }
  return undefined;
}
