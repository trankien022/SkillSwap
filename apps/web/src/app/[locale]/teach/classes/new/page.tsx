import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../../../components/marketplace/MarketplaceHeader';
import { SiteFooter } from '../../../../../components/landing/SiteFooter';
import { VerificationBanner } from '../../../../../components/teacher/VerificationBanner';
import { PublishHeader } from '../../../../../components/teacher/PublishHeader';
import { PublishForm } from '../../../../../components/teacher/PublishForm';
import { MockTeacherPublishGateway } from '../../../../../lib/teacher/mock-gateway';
import type { ClassDraft } from '../../../../../lib/teacher/types';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Force dynamic rendering: the page passes the gateway's
 * publishDraft / saveDraft closures into a Client Component
 * (PublishForm), which is not allowed at SSG time. The page
 * is cheap to render on demand.
 */
export const dynamic = 'force-dynamic';

/**
 * Teacher "publish a class" page (FR-022). Server component.
 * Loads the verified skills + draft through the mock gateway,
 * then mounts the client `PublishForm` which owns the rest of
 * the workspace (sections + pricing + preview + actions + toast).
 */
export default async function PublishClassPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const gateway = new MockTeacherPublishGateway();
  const [skills, draft] = await Promise.all([
    gateway.getVerifiedSkills(),
    gateway.getDraft(),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <MarketplaceHeader currentTab="instructor" />
      <main className="flex-1">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
          <VerificationBanner />
          <PublishHeader />
          <PublishForm
            initialDraft={draft}
            skills={skills}
            publish={(d: ClassDraft) => gateway.publishDraft(d)}
            saveDraft={(d: ClassDraft) => gateway.saveDraft(d)}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
