import { getLocale, getTranslations } from 'next-intl/server';
import { Navbar } from '../../components/navbar';
import { StatePanel } from '../../components/ui/StatePanel';
import { SiteFooter } from '../../components/landing/SiteFooter';
export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations('Workspace.fallback');
  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1">
        <StatePanel
          title={t('notFoundTitle')}
          action={
            <>
              <a href={`/${locale}`} className="workspace-primary">
                {t('home')}
              </a>
              <a href={`/${locale}/classes`} className="workspace-link">
                {t('explore')}
              </a>
            </>
          }
        >
          {t('notFoundBody')}
        </StatePanel>
      </main>
      <SiteFooter />
    </div>
  );
}
