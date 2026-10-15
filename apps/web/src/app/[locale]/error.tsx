'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Navbar } from '../../components/navbar';
import { StatePanel } from '../../components/ui/StatePanel';
import { WorkspaceFooter } from '../../components/ui/WorkspaceFooter';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations('Workspace.fallback');
  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="workspace-page workspace-page-narrow flex-1">
        <StatePanel
          title={t('errorTitle')}
          tone="error"
          action={
            <>
              <button type="button" onClick={reset} className="workspace-primary">
                {t('retry')}
              </button>
              <a href={`/${locale}`} className="workspace-link">
                {t('home')}
              </a>
            </>
          }
        >
          {t('errorBody')}
        </StatePanel>
      </main>
      <WorkspaceFooter />
    </div>
  );
}
