import { ClassDetailApiGateway } from '../../lib/marketplace/api-class-detail';
import { DetailHeader } from './DetailHeader';
import { ScheduleSection } from './ScheduleSection';
import { SyllabusSection } from './SyllabusSection';
import { PrerequisitesSection } from './PrerequisitesSection';
import { TeacherDossierSection } from './TeacherDossierSection';
import { ReviewsSection } from './ReviewsSection';
import { EscrowInlineBanner } from './EscrowInlineBanner';
import { StickyBookingCard } from './StickyBookingCard';
import { ClientClassDetailFallback } from './ClientClassDetailFallback';
import type { ClassDetailView } from '../../lib/marketplace/types';

/**
 * Server-side composition of the class detail page (FR-006 detail).
 *
 * Pulls the detail view from `ClassDetailApiGateway` (which queries GET /api/classes/:id
 * and falls back gracefully to MockClassDetailGateway for demo IDs). If unknown on server,
 * falls back to ClientClassDetailFallback to resolve browser-created classes before rendering 404.
 */
export async function ClassDetailContent({ id }: { id: string }) {
  const gateway = new ClassDetailApiGateway();
  const item = await gateway.getById(id);
  if (!item) return <ClientClassDetailFallback id={id} />;
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