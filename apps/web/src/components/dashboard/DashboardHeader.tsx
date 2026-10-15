import { getTranslations, getLocale } from 'next-intl/server';
import { PageIntro } from '../ui/PageIntro';
export async function DashboardHeader() {
  const t = await getTranslations('Dashboard.page');
  const locale = await getLocale();
  return <PageIntro title={t('title')} description={t('subtitle')} art="online-learning" artAlt={t('artAlt')} actions={<a href={`/${locale}/classes`} className="workspace-primary">{t('ctaExplore')}<span aria-hidden="true">↗</span></a>} />;
}
