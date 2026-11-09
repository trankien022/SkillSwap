import { setRequestLocale } from 'next-intl/server';
import { WorkspaceFooter } from '../../../../../../components/ui/WorkspaceFooter';
import { Navbar } from '../../../../../../components/navbar';
import { TeacherLiveClassroomPage } from '../../../../../../components/classroom/TeacherLiveClassroomPage';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

/**
 * FR-011 / ADR-040: the teacher's classroom.
 *
 * A separate route from `/{locale}/bookings/[id]/live` on purpose. That screen is resolved
 * from the learner's own booking list and is built around escrow and the post-session review,
 * which are the learner's money actions. Reusing it for the teacher is what made the teacher
 * unreachable in the first place.
 */
export default async function TeacherClassLivePage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <TeacherLiveClassroomPage classId={id} />
        </div>
      </main>
      <WorkspaceFooter />
    </div>
  );
}
