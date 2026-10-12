import type { Certificate } from "../../types/verification";

type Props = {
  certificate: Certificate;
  onView?: (c: Certificate) => void;
};

export default function CertificateItem({ certificate, onView }: Props) {
  return (
    <div className="flex items-start gap-3 min-w-0" onClick={() => onView?.(certificate)} role="button" tabIndex={0}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${certificate.status === "approved" ? 'bg-emerald-50 text-emerald-600' : certificate.status === "pending" ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
        <span className="material-symbols-outlined text-[18px]">{certificate.status === "approved" ? 'verified' : certificate.status === "pending" ? 'schedule' : 'dangerous'}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{certificate.title}</p>
          {certificate.linkUrl && (
            <span className="text-xs text-emerald-600 underline truncate">(link)</span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">{certificate.issuer}</p>
        {certificate.imageUrl && (
          <img src={certificate.imageUrl} alt="thumb" className="mt-2 w-20 h-12 object-contain rounded-sm border" />
        )}
      </div>
    </div>
  );
}