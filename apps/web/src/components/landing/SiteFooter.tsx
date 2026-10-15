import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from './LocaleSwitcher';

export async function SiteFooter({ learning = false }: { learning?: boolean } = {}) {
  const t = await getTranslations('Landing.footer');
  return (
    <footer className={learning ? 'w-full bg-mist' : 'w-full border-t border-border bg-surface'}>
      {learning && (
        <div aria-hidden="true" className="learning-footer-wordmark">
          SkillSwap
        </div>
      )}
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-8 text-sm text-ink-soft lg:flex-row lg:px-8">
        <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-2 sm:text-left">
          <span className="text-base font-bold tracking-tight text-ink">SkillSwap</span>
          <span className="hidden sm:inline">—</span>
          <span>{t('tagline')}</span>
        </div>
        <LocaleSwitcher />
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-6 text-center text-sm text-ink-soft lg:px-8">
        © {new Date().getFullYear()} SkillSwap{learning && <> · {t('illustration')}</>}
      </div>
    </footer>
  );
}
