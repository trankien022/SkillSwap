import { getTranslations } from 'next-intl/server';
import { MockClassDetailGateway } from '../../lib/marketplace/mock-class-detail';
import { DetailHeader } from './DetailHeader';
import { ScheduleSection } from './ScheduleSection';
import { SyllabusSection } from './SyllabusSection';
import { PrerequisitesSection } from './PrerequisitesSection';
import { TeacherDossierSection } from './TeacherDossierSection';
import { ReviewsSection } from './ReviewsSection';
import { EscrowInlineBanner } from './EscrowInlineBanner';
import { StickyBookingCard } from './StickyBookingCard';
import type { ClassDetailView } from '../../lib/marketplace/types';

/**
 * Server-side composition of the class detail page (FR-006 detail).
 *
 * Pulls the detail view from `MockClassDetailGateway`. If the id is
 * unknown, renders a 404 panel instead. When a real `HttpClassDetailGateway`
 * ships, the only change is the gateway instantiation.
 */
export async function ClassDetailContent({ id }: { id: string }) {
  const gateway = new MockClassDetailGateway();
  const item = await gateway.getById(id);
  if (!item) return <NotFoundPanel />;
  return <ClassDetailBody item={item} />;
}

function ClassDetailBody({ item }: { item: ClassDetailView }) {
  return (
    <div className="flex flex-col gap-6">
      <DetailHeader item={item} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column (8/12) — content sections */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          <ScheduleSection item={item} />
          <SyllabusSection item={item} />
          <PrerequisitesSection item={item} />
          <TeacherDossierSection item={item} />
          <ReviewsSection item={item} />
          <EscrowInlineBanner />
        </div>
        {/* Right column (4/12) — sticky booking */}
        <div className="lg:col-span-4">
          <StickyBookingCard item={item} />
        </div>
      </div>
    </div>
  );
}

async function NotFoundPanel() {
  const t = await getTranslations('ClassDetail.notFound');
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mist text-ink">
        <SearchOffIcon className="h-7 w-7" />
      </span>
      <h1 className="text-xl font-bold text-ink">{t('title')}</h1>
      <p className="text-sm text-ink-soft">{t('body')}</p>
      <a
        href="../classes"
        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-ink-soft"
      >
        {t('back')}
      </a>
    </div>
  );
}

function SearchOffIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
      <line x1="8" y1="8" x2="14" y2="14" />
    </svg>
  );
}