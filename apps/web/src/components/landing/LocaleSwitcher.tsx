'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '../../i18n/routing';
import { type Locale } from '../../i18n/routing';

/**
 * Locale switcher wired to next-intl navigation.
 *
 * - The provider supplies the current locale. The localized router pathname
 *   deliberately excludes the locale prefix.
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

  const current = useLocale();

  function switchTo(target: Locale) {
    if (target === current) return;
    router.replace(pathname, { locale: target });
  }

  return (
    <div
      aria-label={t('langLabel')}
      role="radiogroup"
      className="inline-flex items-center gap-1 rounded-full bg-neutral-tint p-1 text-xs font-semibold"
    >
      <SwitchButton active={current === 'vi'} onClick={() => switchTo('vi')} label={t('vi')} />
      <SwitchButton active={current === 'en'} onClick={() => switchTo('en')} label={t('en')} />
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
          ? 'inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-surface'
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
