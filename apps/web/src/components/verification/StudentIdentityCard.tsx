import type { StudentIdentity } from "../../types/verification";
import StatusBadge from "../common/StatusBadge";

type Props = {
  student: StudentIdentity;
};

export default function StudentIdentityCard({ student }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between pb-1 border-b border-gray-100">
        <div>
          <h3 className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Thông tin sinh viên</h3>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-[20px]">badge</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{student.title}</h2>
                <StatusBadge status={student.statusLabel} />
              </div>
              <p className="text-xs text-gray-500">{student.issuer}</p>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-400">{student.cohort}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-[11px] text-gray-500">Trường Đại học</div>
          <div className="text-sm font-semibold text-gray-900">{student.school}</div>
          <div className="text-xs text-gray-500">{student.campus}</div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-[11px] text-gray-500">Mã số sinh viên</div>
          <div className="text-sm font-mono font-semibold text-gray-900">{student.studentId || 'N/A'}</div>
          <div className="text-xs text-emerald-600 flex items-center gap-1 mt-1"><span className="material-symbols-outlined text-[13px]">check_circle</span>Khớp hệ thống quản lý đào tạo</div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-[11px] text-gray-500">Email sinh viên</div>
          <div className="text-sm font-semibold text-gray-900">{student.email}</div>
          <div className="text-xs text-gray-500">Đã xác thực OTP định kỳ</div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-gray-100">
          <div className="text-[11px] text-gray-500">Kỳ tái xác thực</div>
          <div className="text-sm font-semibold text-blue-600">{student.nextReauth}</div>
          <div className="text-xs text-gray-500">Còn {student.monthsToNext} tháng đến kỳ hạn kế tiếp</div>
        </div>
      </div>
    </div>
  );
}