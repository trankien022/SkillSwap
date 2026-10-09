import type { Certificate } from "../../types/verification";
import CertificateItem from "../common/CertificateItem";

type Props = {
  certificates: Certificate[];
};

export default function CertificateSection({ certificates }: Props) {
  const pending = certificates.filter((c) => c.status === "pending").length;
  const approved = certificates.filter((c) => c.status === "approved").length;
  return (
    <div className="h-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4 flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">{approved}</div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Chứng chỉ chuyên môn</h3>
            <p className="text-xs text-gray-500">Bằng chứng năng lực do sinh viên cung cấp</p>
          </div>
        </div>
        <div className="text-sm text-gray-500 font-semibold text-right">{certificates.length} mục • {approved} Đã duyệt • {pending} Đang xét</div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {certificates.map((cert) => (
          <CertificateItem key={cert.id} certificate={cert} />
        ))}
      </div>

      <div className="mt-auto text-xs text-gray-500 text-center">Các chứng chỉ được xác thực tự động hoặc qua đối tác khi có.</div>
    </div>
  );
}