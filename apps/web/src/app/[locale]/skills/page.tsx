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
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 lg:px-8">
          <header>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t('title')}</h1>
            <p className="mt-1 text-sm text-slate-600">{t('pageSubtitle')}</p>
          </header>
          <SkillsContent />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
