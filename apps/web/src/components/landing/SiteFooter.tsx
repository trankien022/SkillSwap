import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from './LocaleSwitcher';

/**
 * Minimalist footer (DESIGN.md §5 Navigation mobile + footer pattern).
 *
 * - Mist background, hairline border-top.
 * - Brand tagline + copyright, locale switcher.
 *
 * The footer used to carry three links ("Escrow", "Terms", "Transparency") all
 * pointing at `href="#"` with `aria-disabled`. None of those pages exists, so a
 * link that does nothing is worse than no link: they are removed rather than
 * retargeted at invented routes. Add them back when the pages are built.
 */
export async function SiteFooter() {
  const t = await getTranslations('Landing.footer');

  return (
    <footer className="w-full border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-8 text-sm text-ink-soft lg:flex-row lg:px-8">
        {/* Brand + tagline */}
        <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-2 sm:text-left">
          <span className="text-base font-bold tracking-tight text-ink">
            SkillSwap
          </span>
          <span className="hidden sm:inline">—</span>
          <span>{t('tagline')}</span>
        </div>

        {/* Locale switcher — real next-intl navigation swap */}
        <LocaleSwitcher />
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-6 text-center text-xs text-ink-muted lg:px-8">
        © {new Date().getFullYear()} SkillSwap MVP
      </div>
    </footer>
  );
}