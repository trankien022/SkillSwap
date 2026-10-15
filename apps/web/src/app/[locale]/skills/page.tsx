import { PageIntro } from '../../../components/ui/PageIntro';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { Navbar } from '../../../components/navbar';
import { SiteFooter } from '../../../components/landing/SiteFooter';
import { SkillsContent } from '../../../components/skills/SkillsContent';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Force dynamic rendering: the screen mounts a client component that fetches its
 * own data (`GET /skills`, `GET /profile-skills/me`), both of which require the
 * caller's session and so cannot be read during a static render.
 */
export const dynamic = 'force-dynamic';

/**
 * Skills & Evidence page (S10, FR-003 / FR-018). Server component that renders
 * the chrome and mounts `SkillsContent`.
 *
 * This route did not exist on Web, which is why the parity matrix listed S10 as
 * missing: a learner verified on mobile had nowhere in the browser to see their
 * approved skills or submit evidence.
 */
export default async function SkillsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Skills');

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <Navbar currentTab="skills" />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="workspace-page">
          <PageIntro title={t('title')} description={t('pageSubtitle')} art="design" artAlt={t('artAlt')} />
          <SkillsContent />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
