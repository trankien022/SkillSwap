import { getTranslations } from 'next-intl/server';
import { PageIntro } from '../ui/PageIntro';

export async function DashboardHeader() {
  const t = await getTranslations('Dashboard.page');
  return (
    <PageIntro
      title={t('title')}
      description={t('subtitle')}
      art="online-learning"
      artAlt={t('artAlt')}
    />
  );
}
