import type { EscrowSettlement } from "../../types/class-completion";

export default function EscrowSettlementCard({ escrow }: { escrow: EscrowSettlement | null }) {
  if (!escrow) return null;
  return (
    <div className="p-4 bg-white rounded-md shadow">
      <div className="text-sm text-slate-500">Thanh toán (Escrow)</div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className="p-3 bg-slate-50 rounded">
          <div className="text-xs text-slate-500">Tổng</div>
          <div className="font-semibold">{escrow.totalCredits} credits</div>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <div className="text-xs text-slate-500">Giáo viên</div>
          <div className="font-semibold">{escrow.teacherShare} credits</div>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <div className="text-xs text-slate-500">Phí nền tảng</div>
          <div className="font-semibold">{escrow.platformFee} credits</div>
        </div>
        <div className="p-3 bg-slate-50 rounded">
          <div className="text-xs text-slate-500">Hoàn trả</div>
          <div className="font-semibold">{escrow.studentRefund ?? 0} credits</div>
        </div>
      </div>
    </div>
  );
}
