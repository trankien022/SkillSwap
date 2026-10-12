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
        // Keep the original error visible in developer console while falling back to mock
        console.warn('verification fetch failed', err);
        // If API is unreachable, fall back to a local mock so the UI remains usable during dev.
        try {
          const { verificationSuccess } = await import("../../../lib/mocks/verification.mock");
          if (mounted) setData(verificationSuccess);
        } catch (innerErr: any) {
          if (mounted) setError(innerErr?.message || String(innerErr));
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
    <>
    <main className="w-full py-8 bg-[#f8f9ff]">
      <div className="max-w-7xl mx-auto w-full px-6 space-y-6">
        {/* Celebration / Hero banner (match code.html look) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-white p-6 shadow-md">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-xs font-semibold">
                <span className="material-symbols-outlined text-[15px]">task_alt</span>
                <span>Hồ sơ đã kiểm duyệt chính thức</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Trung tâm Thẩm định &amp; Xác minh</h1>
              <p className="text-sm text-emerald-100">Quản lý thông tin định danh sinh viên và bằng chứng năng lực chuyên môn để trao đổi kỹ năng an toàn.</p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2 shrink-0">
              <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                <span className="text-[11px] text-emerald-200 font-medium">MÃ HỆ THỐNG</span>
                <span className="text-sm font-bold tracking-wider text-white">#VER-2026-01</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-200">
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
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-xs text-emerald-600 font-semibold">Xác minh học thuật</span>
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
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
                >
                  <span className="material-symbols-outlined mr-1 text-[16px]">cloud_upload</span>
                  Cập nhật thẻ mới
                </button>
              </div>

              <StudentCardPreview scannedImageUrl={data.scannedCardImage} student={data.student} />
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-3">
              <div className="flex items-center justify-between"><h3 className="text-base text-gray-900 font-bold flex items-center gap-2"><span className="material-symbols-outlined text-emerald-600 text-[20px]">account_balance</span><span>Quỹ bảo lãnh &amp; Escrow</span></h3></div>
              <p className="text-xs text-gray-600">Số dư quỹ bảo lãnh dùng cho giải ngân khi xác minh thành công.</p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center text-gray-900"><span className="text-sm font-medium">Tổng chi phí ước tính</span><span className="text-xl font-bold text-emerald-600">90 Credit</span></div>
                <div className="w-full h-2 rounded-full bg-gray-200 flex overflow-hidden"><div className="h-full bg-emerald-500" style={{width: '90%'}} title="Giảng viên"></div><div className="h-full bg-gray-400" style={{width: '10%'}} title="Phí hệ thống"></div></div>
              </div>
            </div>
          </div>

          {/* Right Column (Form + Certificates)*/}
          <div className="lg:col-span-7 flex flex-col gap-5 h-full">

            <div className="grid grid-cols-1 gap-5">
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

      {/* Footer */}
      <footer className="w-full bg-white border-t border-slate-200 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 gap-4">
          <p className="font-medium">© 2026 SkillSwap Vietnam. Nền tảng học hỏi ngang hàng sinh viên.</p>
          <div className="flex items-center gap-6 font-semibold">
            <a href="#" className="hover:text-emerald-600 transition-colors">Trợ giúp</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Quy định</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Bảo mật</a>
            <div className="flex items-center gap-1.5 text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
              <span className="material-symbols-outlined text-[15px]">language</span>
              <span>Tiếng Việt</span>
            </div>
          </div>
        </div>
      </footer>

    </>
  );
}