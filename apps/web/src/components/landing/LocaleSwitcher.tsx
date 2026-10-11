'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '../../i18n/routing';
import { routing, type Locale } from '../../i18n/routing';

/**
 * Locale switcher wired to next-intl navigation.
 *
 * - The active locale is derived from usePathname() which already carries
 *   the locale segment in the URL (next-intl middleware injects it).
 * - Clicking a button calls router.replace(path, { locale: target }) so
 *   the page swaps locale without a full reload and keeps scroll position.
 * - Active state is shown with bg-ink + text-surface + a check glyph,
 *   matching DESIGN.md §2 "status text + color, never color alone".
 *
 * This is the only interactive control in the landing footer; it must
 * always work, so no placeholder hrefs.
 */
export function LocaleSwitcher() {
  const t = useTranslations('Landing.footer');
  const router = useRouter();
  const pathname = usePathname();

  const current = currentLocaleFromPath(pathname);

  function switchTo(target: Locale) {
    if (target === current) return;
    router.replace(pathname, { locale: target });
  }

  return (
    <div
      aria-label={t('langLabel')}
      role="group"
      className="inline-flex items-center gap-1 rounded-full bg-neutral-tint p-1 text-xs font-semibold"
    >
      <SwitchButton
        active={current === 'vi'}
        onClick={() => switchTo('vi')}
        label={t('vi')}
      />
      <SwitchButton
        active={current === 'en'}
        onClick={() => switchTo('en')}
        label={t('en')}
      />
    </div>
  );
}

function SwitchButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={
        active
          ? 'inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-surface shadow-sm'
          : 'rounded-full px-3 py-1 text-ink-soft transition-colors hover:text-ink'
      }
    >
      <span>{label}</span>
      {active && (
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

/**
 * Derive the active locale from the first URL segment. next-intl middleware
 * ensures the path always begins with a known locale segment on locale
 * routes, so this is the authoritative source. Falls back to the routing
 * default if the path is missing a segment (e.g. /status on the root).
 */
function currentLocaleFromPath(pathname: string): Locale {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg === 'vi' || seg === 'en') return seg;
  return routing.defaultLocale as Locale;
}