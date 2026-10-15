import { setRequestLocale } from 'next-intl/server';
import { MarketplaceHeader } from '../../../../../components/marketplace/MarketplaceHeader';
import { SiteFooter } from '../../../../../components/landing/SiteFooter';
import { VerificationBanner } from '../../../../../components/teacher/VerificationBanner';
import { PublishHeader } from '../../../../../components/teacher/PublishHeader';
import { PublishWorkspace } from '../../../../../components/teacher/PublishWorkspace';

type PageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Force dynamic rendering: the page mounts a Client Component that fetches its
 * own data (the endpoints it needs are auth-gated, so they cannot be read during
 * a static render).
 */
export const dynamic = 'force-dynamic';

/**
 * Teacher "publish a class" page (FR-022 / FR-005). Server component that
 * renders the chrome and mounts `PublishWorkspace`.
 *
 * The workspace is a client component because both of its data sources require
 * the caller's session:
 *  - verified skills come from `GET /profile-skills/me` (BR-008/BR-010: only an
 *    approved skill can open a class);
 *  - publishing is the real `POST /classes`.
 * A previous version pre-loaded "verified skills" from a mock fixture, so the
 * picker offered skills the server had never verified.
 */
export default async function PublishClassPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-mist text-ink">
      <MarketplaceHeader currentTab="instructor" />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:px-8">
          <VerificationBanner />
          <PublishHeader />
          <PublishWorkspace />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
