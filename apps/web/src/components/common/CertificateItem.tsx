import type { Certificate } from "../../types/verification";

type Props = {
  certificate: Certificate;
};

export default function CertificateItem({ certificate }: Props) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${certificate.status === "approved" ? 'bg-emerald-50 text-emerald-600' : certificate.status === "pending" ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
          <span className="material-symbols-outlined text-[18px]">{certificate.status === "approved" ? 'verified' : certificate.status === "pending" ? 'schedule' : 'dangerous'}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{certificate.title}</p>
          <p className="text-xs text-gray-500">{certificate.issuer}</p>
        </div>
      </div>

      <div className="flex items-center">
        {certificate.status === "approved" ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">check</span>
            <span>Đã duyệt</span>
          </span>
        ) : certificate.status === "pending" ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">Chờ duyệt</span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold">Từ chối</span>
        )}
      </div>
    </div>
  );
}