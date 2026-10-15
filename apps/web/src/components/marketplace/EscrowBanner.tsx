import { getLocale, getTranslations } from 'next-intl/server';

export async function EscrowBanner() {
  const t = await getTranslations('Marketplace.banner');
  const locale = await getLocale();

  return (
    <aside className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_2fr] lg:px-8">
        <h2 className="text-base font-semibold text-ink">{t('title')}</h2>
        <div>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">{t('body')}</p>
          <a
            href={`/${locale}#trust`}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-ink underline decoration-border underline-offset-4 hover:decoration-ink"
          >
            {t('policyLink')}
            <span aria-hidden="true" className="ml-3">
              ↗
            </span>
          </a>
        </div>
      </div>
    </aside>
  );
}
