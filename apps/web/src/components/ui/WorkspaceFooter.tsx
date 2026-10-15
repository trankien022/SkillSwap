'use client';
import { useLocale, useTranslations } from 'next-intl';

/** Client-safe footer for pages that own their data and interactive workspace. */
export function WorkspaceFooter() {
  const locale = useLocale();
  const t = useTranslations('Landing.footer');
  const w = useTranslations('Workspace');
  return <footer className="border-t border-border bg-surface"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 text-sm text-ink-soft"><a href={`/${locale}`} className="inline-flex min-h-11 items-center gap-3"><strong className="text-ink">SkillSwap</strong><span>{t('tagline')}</span></a><a href={`/${locale}#trust`} className="workspace-link">{w('rules')}</a><span>© {new Date().getFullYear()} SkillSwap</span></div></footer>;
}
