import type { AcademicMetrics } from "../../types/verification";

type Props = {
  metrics: AcademicMetrics;
};

export default function AcademicReputationCard({ metrics }: Props) {
  const items = [
    { label: "Hoàn thành buổi học", value: metrics.courseCompletion, icon: "check_circle" },
    { label: "Khiếu nại & tranh chấp", value: metrics.disputes, icon: "gavel" },
    { label: "Đánh giá ngang hàng", value: metrics.peerRating, icon: "star" },
  ];

  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, Number(metrics.score) || 0));
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div className="h-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">Uy tín &amp; Đánh giá</h3>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">Độ tin cậy</span>
        </div>

        <div className="flex items-center justify-center py-3 mb-4">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="48" fill="transparent" stroke="#eef2ff" strokeWidth="8" />
              <circle cx="60" cy="60" r="48" fill="transparent" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" strokeDasharray={String(circumference)} strokeDashoffset={String(dashOffset)} />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-bold text-gray-900 leading-none tracking-tight">{metrics.score}</span>
              <span className="text-xs text-gray-500 uppercase mt-1">/ 100 Điểm</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.label} className="p-3 rounded-lg bg-gray-50 flex items-center justify-between border border-gray-100">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[18px] text-blue-600">{it.icon}</span>
                <span className="text-sm text-gray-900">{it.label}</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{it.value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center mt-3">Được bảo chứng qua {metrics.verifications} lượt thẩm định.</p>
    </div>
  );
}