"use client";

import StudentIdentityCard from "../../../components/verification/StudentIdentityCard";
import StudentCardPreview from "../../../components/verification/StudentCardPreview";
import AcademicReputationCard from "../../../components/verification/AcademicReputationCard";
import CertificateSection from "../../../components/verification/CertificateSection";
import SecurityCommitmentSection from "../../../components/verification/SecurityCommitmentSection";
import LoadingState from "../../../components/common/LoadingState";
import ErrorState from "../../../components/common/ErrorState";
import EmptyState from "../../../components/common/EmptyState";

import { useEffect, useState } from "react";
import { DEFAULT_API_BASE, fetchJson } from "../../../lib/status";
import type { VerificationData } from "../../../types/verification";

export default function Page() {
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // In dev use a relative path so Next.js rewrites can proxy the request to the gateway (avoids CORS).
        const endpoint = (process.env.NODE_ENV === 'development')
          ? `/api/student-verification/status`
          : `${DEFAULT_API_BASE}/api/student-verification/status`;
        const resp = await fetchJson<VerificationData>(endpoint);
        if (mounted) setData(resp);
      } catch (err: any) {
        // If API is unreachable, fall back to a local mock so the UI remains usable during dev.
        try {
          const { verificationSuccess } = await import("../../../lib/mocks/verification.mock");
          if (mounted) setData(verificationSuccess);
        } catch (_) {
          if (mounted) setError(err?.message || String(err));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <LoadingState message="Đang tải thông tin xác minh…" />;
  if (error) return <ErrorState title="Lỗi khi tải dữ liệu" description={error} />;
  if (!data) return <EmptyState message="No verification data available." />;

  return (
    <main className="w-full py-8 bg-[#f8f9ff]">
      <div className="max-w-7xl mx-auto w-full px-6 space-y-6">
        {/* Celebration / Hero banner (match code.html look) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 to-blue-600 text-white p-6 shadow-md">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-xs font-semibold">
                <span className="material-symbols-outlined text-[15px]">task_alt</span>
                <span>Hồ sơ đã kiểm duyệt chính thức</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Trung tâm Thẩm định &amp; Xác minh</h1>
              <p className="text-sm text-blue-100">Quản lý thông tin định danh sinh viên và bằng chứng năng lực chuyên môn để trao đổi kỹ năng an toàn.</p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2 shrink-0">
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                <span className="text-[11px] text-blue-200 font-medium">MÃ HỆ THỐNG</span>
                <span className="text-sm font-bold tracking-wider text-white">#VER-2026-01</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-200">
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                <span>Hệ thống xác minh nội bộ</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column */}
          <div className="lg:col-span-5 flex flex-col gap-5 h-full">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4 h-full">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Thông tin sinh viên</span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-xs text-blue-600 font-semibold">Xác minh học thuật</span>
              </div>
              <StudentIdentityCard student={data.student} />

              <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-center">
                <div className="bg-white rounded-lg p-2 border border-gray-100"><div className="text-[11px] text-gray-500">Mã sinh viên</div><div className="text-xs text-gray-900 font-bold truncate">{data.student.studentId || 'N/A'}</div></div>
                <div className="bg-white rounded-lg p-2 border border-gray-100"><div className="text-[11px] text-gray-500">Trạng thái xác minh</div><div className="text-xs text-emerald-600 font-bold">{data.student.statusLabel === 'verified' ? 'Đã xác minh' : 'Chưa xác minh'}</div></div>
              </div>

            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold">Bản quét thẻ sinh viên</h3>
                  <p className="text-xs text-slate-500">Hình ảnh mã hoá, thông tin nhạy cảm đã che mờ.</p>
                </div>
                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                >
                  <span className="material-symbols-outlined mr-1 text-[16px]">cloud_upload</span>
                  Cập nhật thẻ mới
                </button>
              </div>

              <StudentCardPreview scannedImageUrl={data.scannedCardImage} student={data.student} />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-base text-gray-900 font-bold flex items-center gap-2"><span className="material-symbols-outlined text-blue-600 text-[20px]">account_balance</span><span>Quỹ bảo lãnh &amp; Escrow</span></h3></div>
              <p className="text-xs text-gray-600">Số dư quỹ bảo lãnh dùng cho giải ngân khi xác minh thành công.</p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-gray-900"><span className="text-sm font-medium">Tổng chi phí ước tính</span><span className="text-xl font-bold text-blue-600">90 Credit</span></div>
                <div className="w-full h-2 rounded-full bg-gray-200 flex overflow-hidden"><div className="h-full bg-emerald-500" style={{width: '90%'}} title="Giảng viên"></div><div className="h-full bg-gray-400" style={{width: '10%'}} title="Phí hệ thống"></div></div>
              </div>
            </div>
          </div>

          {/* Right Column (Form + Certificates)*/}
          <div className="lg:col-span-7 flex flex-col gap-5 h-full">
            <form className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6" onSubmit={(e)=>e.preventDefault()}>
              <div className="space-y-1">
                <div className="flex items-center justify-between"><span className="text-xs text-blue-600 font-semibold flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">verified</span>Đánh giá &amp; Hoàn tất</span><span className="text-xs text-gray-400">Sinh viên → Giảng viên</span></div>
                <h2 className="text-xl text-gray-900 font-bold">Đánh giá chất lượng &amp; Hoàn tất xác minh</h2>
                <p className="text-sm text-gray-600">Phản hồi này sẽ được ghi vào hồ sơ tín nhiệm.</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-5 text-center space-y-2 border border-gray-100">
                <span className="text-sm text-gray-900 font-semibold block">Mức độ hài lòng chung về buổi học</span>
                <div className="flex items-center justify-center gap-2" id="starContainer">
                  {[1,2,3,4,5].map((v)=> (
                    <button key={v} type="button" className={`focus:outline-none transition-transform hover:scale-125 ${v<=5? 'text-amber-400': 'text-gray-300'}`}>
                      <span className="material-symbols-outlined text-[36px]" style={{fontVariationSettings: v<=5 ? "'FILL' 1" : "'FILL' 0"}}>star</span>
                    </button>
                  ))}
                </div>
                <div className="text-sm text-amber-600 font-bold">Rất tốt (5.0 / 5.0)</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-900 font-bold block">Nhận xét chi tiết</label>
                <p className="text-xs text-gray-500">Chọn nhanh phản hồi nổi bật bên dưới để thêm vào nội dung đánh giá:</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button type="button" className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-blue-50 text-xs">Sửa phát âm</button>
                  <button type="button" className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-blue-50 text-xs">Tài liệu sát đề</button>
                  <button type="button" className="px-2.5 py-1 rounded-full bg-gray-100 hover:bg-blue-50 text-xs">Hướng dẫn rõ ràng</button>
                </div>
                <textarea className="w-full p-3 rounded-xl border border-gray-200 bg-white text-sm" rows={5} defaultValue={"Hồ sơ đã được kiểm tra. Ghi chú: thông tin học tập khớp."} />
              </div>

              <div>
                <button type="submit" className="w-full px-4 py-3 rounded-xl text-white font-semibold bg-blue-600 hover:bg-blue-700">Gửi đánh giá &amp; Hoàn tất</button>
              </div>
            </form>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
                <h4 className="text-base font-bold">Uy tín</h4>
                <div className="mt-4 flex-1">
                  <AcademicReputationCard metrics={data.metrics} />
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
                <h4 className="text-base font-bold">Chứng chỉ chuyên môn</h4>
                <div className="mt-4 flex-1">
                  <CertificateSection certificates={data.certificates} />
                </div>
              </div>
            </div>

          </div>

          <div className="lg:col-span-12">
            <SecurityCommitmentSection />
          </div>
        </div>
      </div>
    </main>
  );
}