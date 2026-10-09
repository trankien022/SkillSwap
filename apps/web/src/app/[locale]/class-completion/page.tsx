import CompletionHero from "../../../components/class-completion/CompletionHero";
import SessionInfoCard from "../../../components/class-completion/SessionInfoCard";
import EscrowSettlementCard from "../../../components/class-completion/EscrowSettlementCard";
import SessionDocumentsCard from "../../../components/class-completion/SessionDocumentsCard";
import SkillSwapSuggestion from "../../../components/class-completion/SkillSwapSuggestion";
import ReviewForm from "../../../components/class-completion/ReviewForm";
import SectionHeader from "../../../components/common/SectionHeader";
import StatCard from "../../../components/common/StatCard";
import LoadingState from "../../../components/common/LoadingState";
import ErrorState from "../../../components/common/ErrorState";
import EmptyState from "../../../components/common/EmptyState";

import type { Status } from "../../../types/class-completion";
import {
  completionSuccess,
  completionLoading,
  completionError,
  completionEmpty,
} from "../../../lib/mocks/class-completion.mock";

export default function Page({ searchParams }: { searchParams?: { state?: string } }) {
  const state = (searchParams?.state as Status) ?? 'success';

  let data;
  switch (state) {
    case 'loading':
      data = completionLoading;
      break;
    case 'error':
      data = completionError;
      break;
    case 'empty':
      data = completionEmpty;
      break;
    default:
      data = completionSuccess;
  }

  if (state === 'loading') return <LoadingState />;
  if (state === 'error') return <ErrorState title="Lỗi tải dữ liệu" description="Không thể lấy thông tin hoàn thành lớp." />;
  if (state === 'empty') return <EmptyState message="Không có buổi học nào để hoàn thành." />;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <CompletionHero title="Hoàn thành buổi học" subtitle="Gửi phản hồi và nhận thanh toán" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <SessionInfoCard session={data.session} teacher={data.teacher} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <EscrowSettlementCard escrow={data.escrow} />
              <SessionDocumentsCard documents={data.documents} />
            </div>

            <div>
              <SectionHeader title="Đánh giá buổi học" subtitle="Giúp giáo viên cải thiện nội dung" />
              <div className="mt-3">
                <ReviewForm defaultRating={data.rating ?? 0} />
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="p-4 bg-white rounded-md shadow">
              <StatCard label="Tổng tiền" value={data.escrow?.totalCredits ?? '—'} />
            </div>

            <SkillSwapSuggestion items={data.suggestions} />
          </aside>
        </div>
      </div>
    </main>
  );
}
